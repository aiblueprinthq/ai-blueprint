import { spawnSync } from "node:child_process";
import type { SpawnSyncOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const packageRoot = path.join(repoRoot, "packages", "create-ai-blueprint");
const runsRoot = path.join(__dirname, "runs");

interface CommandOptions extends SpawnSyncOptions {
  allowFailure?: boolean;
}

function runNpm(args: string[], cwd: string) {
  if (process.platform !== "win32") {
    return run("npm", args, cwd);
  }

  return run(process.env.ComSpec || "cmd.exe", [
    "/d",
    "/s",
    "/c",
    `npm ${args.join(" ")}`
  ], cwd);
}

interface Check {
  phase: string;
  description: string;
  passed: boolean;
}

type AgentName = "claude" | "copilot";

interface AgentResult {
  status: number | null;
  resultText: string;
  transcript: unknown;
}

interface Scenario {
  name: string;
  description: string;
  run: (runner: Runner) => Promise<void>;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  options: CommandOptions = {}
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status}): ${(result.stderr || "").slice(0, 2000)}`
    );
  }

  return result;
}

function git(workspace: string, ...args: string[]): string {
  return String(run("git", args, workspace).stdout).trim();
}

class Runner {
  name: string;
  checks: Check[];
  currentPhase: string;
  runDir: string;
  workspace: string;
  phaseCount: number;

  constructor(scenarioName: string) {
    this.name = scenarioName;
    this.checks = [];
    this.currentPhase = "setup";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.runDir = path.join(runsRoot, `${stamp}-${scenarioName}`);
    this.workspace = path.join(this.runDir, "workspace");
    this.phaseCount = 0;
    fs.mkdirSync(this.workspace, { recursive: true });
  }

  phase(name: string): void {
    this.currentPhase = name;
    console.log(`\n== ${this.name} / ${name} ==`);
  }

  check(description: string, condition: unknown): void {
    this.checks.push({ phase: this.currentPhase, description, passed: Boolean(condition) });
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${description}`);
  }

  // Installs the packed local tarball into the run's workspace, so every
  // scenario exercises exactly what `npm publish` would ship.
  installBlueprint(adapterFlag = getDefaultAdapterFlag()): void {
    const artifacts = path.join(this.runDir, "artifacts");
    const runner = path.join(this.runDir, "npm-runner");
    fs.mkdirSync(artifacts, { recursive: true });
    fs.mkdirSync(runner, { recursive: true });

    runNpm(["pack", "--pack-destination", path.relative(packageRoot, artifacts)], packageRoot);
    const tarball = fs.readdirSync(artifacts).find((file) => file.endsWith(".tgz"));

    if (!tarball) {
      throw new Error("npm pack produced no tarball");
    }

    runNpm(
      [
        "install",
        "--prefix",
        "npm-runner",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        `./artifacts/${tarball}`
      ],
      this.runDir
    );

    const binary = path.join(
      runner,
      "node_modules",
      "create-ai-blueprint",
      "dist",
      "bin",
      "create-ai-blueprint.js"
    );
    run(process.execPath, [binary, "--target", this.workspace, adapterFlag, "--yes"], this.runDir);
  }

  gitInit(): void {
    run("git", ["init", "-b", "main"], this.workspace);
    run("git", ["config", "user.email", "e2e@ai-blueprint.test"], this.workspace);
    run("git", ["config", "user.name", "Blueprint E2E"], this.workspace);
  }

  write(relativePath: string, content: string): void {
    const target = path.join(this.workspace, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  read(relativePath: string): string | null {
    const target = path.join(this.workspace, relativePath);
    return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
  }

  git(...args: string[]): string {
    return git(this.workspace, ...args);
  }

  // One headless agent invocation. The transcript JSON is saved per phase so a
  // failing assertion can be traced back to what the agent actually did.
  agent(
    prompt: string,
    { maxTurns = 50, timeoutMs = 15 * 60 * 1000 }: { maxTurns?: number; timeoutMs?: number } = {}
  ): AgentResult {
    this.phaseCount += 1;
    const agent = getAgentName();
    const args = agent === "claude"
      ? [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--max-turns",
          String(maxTurns),
          "--dangerously-skip-permissions"
        ]
      : [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--allow-all",
          "--no-ask-user",
          "--no-remote",
          "--no-remote-export"
        ];

    if (process.env.E2E_MODEL) {
      args.push("--model", process.env.E2E_MODEL);
    }

    const env = { ...process.env };
    if (agent === "claude") {
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;
    }

    const result = run(agent, args, this.workspace, {
      allowFailure: true,
      timeout: timeoutMs,
      env
    });

    const logBase = path.join(this.runDir, `phase-${this.phaseCount}`);
    fs.writeFileSync(`${logBase}.stdout.jsonl`, result.stdout || "");

    if (result.stderr) {
      fs.writeFileSync(`${logBase}.stderr.log`, result.stderr);
    }

    const transcript = parseAgentTranscript(String(result.stdout), agent);

    return {
      status: result.status,
      resultText: extractAgentText(transcript),
      transcript
    };
  }

  report(): number {
    const failed = this.checks.filter((check) => !check.passed);
    console.log(`\n${this.name}: ${this.checks.length - failed.length}/${this.checks.length} checks passed`);

    if (failed.length > 0) {
      console.log(`Artifacts: ${this.runDir}`);
    }

    return failed.length;
  }
}

function getAgentName(): AgentName {
  const configured = process.env.E2E_AGENT || "claude";

  if (configured === "claude" || configured === "copilot") {
    return configured;
  }

  throw new Error(`Unsupported E2E_AGENT: ${configured}. Use "claude" or "copilot".`);
}

function getDefaultAdapterFlag(): "--all" | "--claude" {
  return getAgentName() === "copilot" ? "--all" : "--claude";
}

function ensureAgentAvailable(): void {
  const agent = getAgentName();
  const probe = spawnSync(agent, ["--version"], { encoding: "utf8" });

  if (probe.error || probe.status !== 0) {
    throw new Error(`The ${agent} CLI is required for e2e runs and was not found on PATH.`);
  }
}

function parseAgentTranscript(stdout: string, agent: AgentName): unknown {
  if (agent === "claude") {
    try {
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  return stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return line;
      }
    });
}

function extractAgentText(transcript: unknown): string {
  const text: string[] = [];

  function visit(value: unknown, key?: string): void {
    if (typeof value === "string") {
      if (!key || ["content", "message", "result", "text", "assistant_content"].includes(key)) {
        text.push(value);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry));
      return;
    }

    if (typeof value === "object" && value !== null) {
      for (const [property, entry] of Object.entries(value)) {
        visit(entry, property);
      }
    }
  }

  visit(transcript);
  return text.join("\n");
}

export type { Scenario };
export { Runner, ensureAgentAvailable };
