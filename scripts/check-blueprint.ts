import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
interface CheckCommand {
  name: string;
  command: string;
  args: string[];
}

const checks: CheckCommand[] = [
  {
    name: "Static Blueprint contract",
    ...npmInvocation(["run", "check:static"])
  },
  {
    name: "Skill routing evaluations",
    ...npmInvocation(["run", "test:routing"])
  },
  {
    name: "Installer unit tests",
    ...npmInvocation(["--prefix", "packages/create-ai-blueprint", "test"])
  },
  {
    name: "Packed installer smoke tests",
    ...npmInvocation(["run", "test:package"])
  }
];

function npmInvocation(args: string[]): Pick<CheckCommand, "command" | "args"> {
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", `npm ${args.join(" ")}`]
  };
}

for (const check of checks) {
  console.log(`\n[check] ${check.name}`);
  const result = spawnSync(check.command, check.args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
      npm_config_update_notifier: "false"
    },
    stdio: "inherit"
  });

  if (result.error) {
    console.error(
      `[fail] ${check.name}: ${result.error instanceof Error ? result.error.message : String(result.error)}`
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`[fail] ${check.name}`);
    process.exit(result.status || 1);
  }
}

console.log("\nAI Blueprint validation passed.");
