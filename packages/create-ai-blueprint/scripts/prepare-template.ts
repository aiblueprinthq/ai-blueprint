import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const templateRoot = path.join(packageRoot, "template");

const entries: readonly string[] = ["AGENTS.md", "CLAUDE.md", ".agents", ".claude", "blueprint"];

async function copyEntry(entry: string): Promise<void> {
  const source = path.join(repoRoot, entry);
  const target = path.join(templateRoot, entry);
  await fs.cp(source, target, { recursive: true });
}

// OpenCode reads .agents/skills natively, so its tree is mirrored rather than
// kept as a third hand-edited copy that would drift from the other adapters.
async function mirrorOpencodeSkills(): Promise<void> {
  await fs.cp(
    path.join(templateRoot, ".agents", "skills"),
    path.join(templateRoot, ".opencode", "skills"),
    { recursive: true }
  );
}

async function main(): Promise<void> {
  await fs.rm(templateRoot, { recursive: true, force: true });
  await fs.mkdir(templateRoot, { recursive: true });

  for (const entry of entries) {
    await copyEntry(entry);
  }

  await mirrorOpencodeSkills();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
