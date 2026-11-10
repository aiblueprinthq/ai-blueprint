import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(scriptPath), "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const templateRoot = path.join(packageRoot, "template");

const entries: readonly string[] = ["AGENTS.md", "CLAUDE.md", ".agents", ".claude", "blueprint"];

// Only Git-tracked files ship, so local packs match a clean CI checkout and
// never pick up ignored or untracked local files such as `.claude/worktrees/`.
export async function prepareTemplate(sourceRoot: string, destination: string): Promise<void> {
  const trackedFiles = execFileSync("git", ["ls-files", "-z", "--", ...entries], {
    cwd: sourceRoot,
    encoding: "utf8"
  })
    .split("\0")
    .filter(Boolean);

  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });

  for (const relativePath of trackedFiles) {
    const segments = relativePath.split("/");
    const source = path.join(sourceRoot, ...segments);

    // A tracked file deleted in the working tree is not part of the next commit.
    if (!existsSync(source)) {
      continue;
    }

    const target = path.join(destination, ...segments);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedPath === scriptPath) {
  prepareTemplate(repoRoot, templateRoot).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
