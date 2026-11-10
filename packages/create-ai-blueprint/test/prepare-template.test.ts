import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareTemplate } from "../scripts/prepare-template.js";

test("template contains only tracked Blueprint files", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-prepare-template-"));
  const sourceRoot = path.join(workspace, "source");
  const templateRoot = path.join(workspace, "template");

  try {
    await writeFiles(sourceRoot, {
      "AGENTS.md": "Blueprint instructions\n",
      "CLAUDE.md": "@AGENTS.md\n",
      "README.md": "Repository readme\n",
      ".agents/skills/check/SKILL.md": "Check skill\n",
      ".claude/skills/check/SKILL.md": "Check skill\n",
      ".claude/skills/check/reference/removed.md": "Deleted before commit\n",
      "blueprint/workflow.md": "Workflow reference\n"
    });
    execFileSync("git", ["init", "--quiet"], { cwd: sourceRoot });
    execFileSync("git", ["add", "."], { cwd: sourceRoot });
    await fs.rm(path.join(sourceRoot, ".claude/skills/check/reference/removed.md"));
    await writeFiles(sourceRoot, {
      ".claude/worktrees/feature/AGENTS.md": "Another checkout\n",
      ".claude/settings.local.json": "{}\n",
      "blueprint/.state/run.json": "{}\n"
    });

    await prepareTemplate(sourceRoot, templateRoot);

    assert.deepEqual(await listFiles(templateRoot), [
      ".agents/skills/check/SKILL.md",
      ".claude/skills/check/SKILL.md",
      "AGENTS.md",
      "CLAUDE.md",
      "blueprint/workflow.md"
    ]);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, ...relativePath.split("/"));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")
    )
    .sort();
}
