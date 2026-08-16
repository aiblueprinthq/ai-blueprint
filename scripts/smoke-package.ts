import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const packageRoot = path.join(repoRoot, "packages", "create-ai-blueprint");

type Adapter = "codex" | "claude";

interface PackageManifest {
  schemaVersion: number;
  version: string;
  adapters: Adapter[];
  managedFiles: Record<string, string>;
}

const modes: Record<string, Adapter[]> = {
  codex: ["codex"],
  claude: ["claude"],
  both: ["claude", "codex"]
};

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function parseRecord(content: string, source: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(content);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function parseManifest(content: string): PackageManifest {
  const manifest = parseRecord(content, "Installed manifest");

  if (
    typeof manifest.schemaVersion !== "number" ||
    typeof manifest.version !== "string" ||
    !Array.isArray(manifest.adapters) ||
    !manifest.adapters.every((adapter): adapter is Adapter => adapter === "codex" || adapter === "claude") ||
    typeof manifest.managedFiles !== "object" ||
    manifest.managedFiles === null ||
    Array.isArray(manifest.managedFiles)
  ) {
    throw new Error("Installed manifest has an invalid shape");
  }

  return {
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    adapters: manifest.adapters,
    managedFiles: manifest.managedFiles as Record<string, string>
  };
}

async function main(): Promise<void> {
  const workspace = await fs.mkdtemp(
    path.join(repoRoot, "node_modules", ".ai-blueprint-package-")
  );

  try {
    const artifactsDir = path.join(workspace, "artifacts");
    const runnerDir = path.join(workspace, "runner");
    await fs.mkdir(artifactsDir, { recursive: true });
    await fs.mkdir(runnerDir, { recursive: true });

    runNpm(
      ["pack", "--pack-destination", path.relative(packageRoot, artifactsDir)],
      packageRoot
    );
    const artifacts = (await fs.readdir(artifactsDir)).filter((file) =>
      file.endsWith(".tgz")
    );

    if (artifacts.length !== 1) {
      throw new Error(`Expected one package artifact, found ${artifacts.length}`);
    }

    const tarball = path.join(artifactsDir, artifacts[0]);
    runNpm(
      [
        "install",
        "--prefix",
        "runner",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-package-lock",
        `./artifacts/${artifacts[0]}`
      ],
      workspace
    );

    const installedPackageRoot = path.join(
      runnerDir,
      "node_modules",
      "create-ai-blueprint"
    );
    const binary = path.join(installedPackageRoot, "dist", "bin", "create-ai-blueprint.js");
    const metadata = parseRecord(
      await fs.readFile(path.join(installedPackageRoot, "package.json"), "utf8"),
      "Installed package metadata"
    );

    if (typeof metadata.version !== "string") {
      throw new Error("Installed package metadata has no valid version");
    }
    await requirePath(path.join(installedPackageRoot, "dist", "lib", "update.js"));
    await requirePath(path.join(installedPackageRoot, "template", "blueprint", "README.md"));
    await requireMissing(path.join(installedPackageRoot, "evals"));
    await requireMissing(path.join(installedPackageRoot, "scripts", "evals"));
    await requireMissing(path.join(installedPackageRoot, "scripts", "e2e"));

    for (const [mode, adapters] of Object.entries(modes)) {
      const targetDir = path.join(workspace, `target-${mode}`);
      await fs.mkdir(targetDir, { recursive: true });
      run(
        process.execPath,
        [binary, "--target", targetDir, `--${mode}`, "--yes"],
        workspace
      );
      await validateInstall(targetDir, metadata.version, adapters);

      const updateResult = run(
        process.execPath,
        [binary, "update", "--target", targetDir, "--dry-run"],
        workspace,
        true
      );

      for (const expectedLine of [
        "Add: 0",
        "Update: 0",
        "Remove: 0",
        "Conflicts: 0"
      ]) {
        if (!updateResult.stdout.includes(expectedLine)) {
          throw new Error(
            `${mode} update smoke test did not report ${expectedLine.toLowerCase()}`
          );
        }
      }
    }

    console.log("Packed installer passed for codex, claude, and both adapter modes.");
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

async function validateInstall(
  targetDir: string,
  version: string,
  adapters: readonly Adapter[]
): Promise<void> {
  const expectsCodex = adapters.includes("codex");
  const expectsClaude = adapters.includes("claude");
  const expectedPaths = [
    "AGENTS.md",
    "blueprint/README.md",
    "blueprint/project-plan.md",
    "blueprint/build-plan.md",
    "blueprint/context/findings.md",
    "blueprint/.state/manifest.json",
    "blueprint/.state/.gitignore"
  ];

  if (expectsCodex) {
    expectedPaths.push(
      ".agents/skills/onboard/SKILL.md",
      ".agents/skills/rollback/SKILL.md"
    );
  }

  if (expectsClaude) {
    expectedPaths.push(
      "CLAUDE.md",
      ".claude/skills/onboard/SKILL.md",
      ".claude/skills/rollback/SKILL.md"
    );
  }

  for (const relativePath of expectedPaths) {
    await requirePath(path.join(targetDir, ...relativePath.split("/")));
  }

  await requireMissing(path.join(targetDir, "README.md"));
  await requireMissing(path.join(targetDir, ".ai-blueprint"));

  if (!expectsCodex) {
    await requireMissing(path.join(targetDir, ".agents"));
  }

  if (!expectsClaude) {
    await requireMissing(path.join(targetDir, ".claude"));
    await requireMissing(path.join(targetDir, "CLAUDE.md"));
  }

  const manifest = parseManifest(
    await fs.readFile(
      path.join(targetDir, "blueprint", ".state", "manifest.json"),
      "utf8"
    )
  );

  if (manifest.schemaVersion !== 1) {
    throw new Error(`Unsupported installed manifest schema: ${manifest.schemaVersion}`);
  }

  if (manifest.version !== version) {
    throw new Error(`Installed version mismatch: ${manifest.version} !== ${version}`);
  }

  if (JSON.stringify(manifest.adapters) !== JSON.stringify(adapters)) {
    throw new Error(
      `Installed adapters mismatch: ${manifest.adapters.join(", ")} !== ${adapters.join(", ")}`
    );
  }

  const expectedManagedFiles = ["blueprint/README.md"];

  if (expectsCodex) {
    expectedManagedFiles.push(
      ...(await listFiles(path.join(targetDir, ".agents", "skills"))).map(
        (file) => `.agents/skills/${file}`
      )
    );
  }

  if (expectsClaude) {
    expectedManagedFiles.push(
      ...(await listFiles(path.join(targetDir, ".claude", "skills"))).map(
        (file) => `.claude/skills/${file}`
      )
    );
  }

  const installedManagedFiles = Object.keys(manifest.managedFiles).sort();

  if (
    JSON.stringify(expectedManagedFiles.sort()) !==
    JSON.stringify(installedManagedFiles)
  ) {
    throw new Error("Installed manifest does not match the managed file inventory");
  }

  for (const [relativePath, expectedHash] of Object.entries(manifest.managedFiles)) {
    const installedFile = path.join(targetDir, ...relativePath.split("/"));
    const actualHash = crypto
      .createHash("sha256")
      .update(await fs.readFile(installedFile))
      .digest("hex");

    if (actualHash !== expectedHash) {
      throw new Error(`Managed file hash mismatch: ${relativePath}`);
    }
  }
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(current: string, relative: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const nextPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await visit(nextPath, nextRelative);
      } else if (entry.isFile()) {
        files.push(nextRelative);
      } else {
        throw new Error(`Unsupported installed entry: ${nextRelative}`);
      }
    }
  }

  await visit(root, "");
  return files.sort();
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
  capture = false
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false"
    },
    stdio: capture ? "pipe" : "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = capture ? result.stderr.trim() : "";
    throw new Error(
      `${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`
    );
  }

  return result;
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

async function requirePath(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      throw new Error(`Expected packaged path is missing: ${filePath}`);
    }

    throw error;
  }
}

async function requireMissing(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      return;
    }

    throw error;
  }

  throw new Error(`Unexpected installed path: ${filePath}`);
}

main().catch((error: unknown) => {
  console.error(
    `Packed installer smoke test failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
