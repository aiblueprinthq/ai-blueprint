import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  ADAPTER_PROMPT,
  getTemplateEntries,
  getGlobalCliInstallCommand,
  getGlobalCliPrompt,
  isGlobalCliInstallConfirmed,
  parseArgs,
  selectGlobalCliAction,
  shouldOfferGlobalCliInstall
} from "../bin/create-ai-blueprint.js";
import {
  CONTROL_DIR,
  MANIFEST_PATH,
  adapterListFromMode,
  applyPreparedUpdate,
  prepareUpdate,
  readManifest,
  writeInstallManifest
} from "../lib/update.js";

test("parseArgs supports install and update modes", () => {
  assert.equal(
    ADAPTER_PROMPT,
    "Install which adapter?\n1: Codex\n2: Claude Code\n3: GitHub Copilot\n4: OpenCode\n5: all (default): "
  );
  assert.equal(parseArgs([]).command, "install");
  assert.deepEqual(parseArgs(["update", "--dry-run"]), {
    adapter: null,
    command: "update",
    deprecatedBoth: false,
    deprecatedUi: false,
    dryRun: true,
    force: false,
    help: false,
    json: false,
    open: true,
    target: null,
    version: false,
    yes: false
  });
  assert.deepEqual(parseArgs(["status", "--json", "--target", "./app"]), {
    adapter: null,
    command: "status",
    deprecatedBoth: false,
    deprecatedUi: false,
    dryRun: false,
    force: false,
    help: false,
    json: true,
    open: true,
    target: "./app",
    version: false,
    yes: false
  });
  assert.throws(
    () => parseArgs(["update", "--codex"]),
    /Update detects the installed adapters/
  );
  assert.deepEqual(parseArgs(["dashboard", "--no-open", "--target", "./app"]), {
    adapter: null,
    command: "dashboard",
    deprecatedBoth: false,
    deprecatedUi: false,
    dryRun: false,
    force: false,
    help: false,
    json: false,
    open: false,
    target: "./app",
    version: false,
    yes: false
  });
  assert.deepEqual(parseArgs(["ui", "--no-open"]), {
    adapter: null,
    command: "dashboard",
    deprecatedBoth: false,
    deprecatedUi: true,
    dryRun: false,
    force: false,
    help: false,
    json: false,
    open: false,
    target: null,
    version: false,
    yes: false
  });
  assert.throws(
    () => parseArgs(["dashboard", "--json"]),
    /--json is available only with the status command/
  );
  assert.throws(
    () => parseArgs(["status", "--no-open"]),
    /Status accepts only/
  );
  assert.throws(
    () => parseArgs(["status", "--force"]),
    /Status accepts only/
  );
  assert.throws(
    () => parseArgs(["--json"]),
    /--json is available only with the status command/
  );
  assert.equal(parseArgs(["--copilot"]).adapter, "copilot");
  assert.equal(parseArgs(["--opencode"]).adapter, "opencode");
  assert.equal(parseArgs(["--all"]).adapter, "all");
  assert.deepEqual(parseArgs(["--both"]), {
    adapter: "all",
    command: "install",
    deprecatedBoth: true,
    deprecatedUi: false,
    dryRun: false,
    force: false,
    help: false,
    json: false,
    open: true,
    target: null,
    version: false,
    yes: false
  });
});

test("Copilot shares the .agents adapter files without managing Copilot instructions", () => {
  assert.deepEqual(
    getTemplateEntries("copilot").map((entry) => entry.target),
    ["AGENTS.md", "blueprint", ".agents"]
  );
  assert.deepEqual(
    getTemplateEntries("all").map((entry) => entry.target),
    ["AGENTS.md", "blueprint", ".agents", "CLAUDE.md", ".claude", ".opencode"]
  );
  assert.deepEqual(adapterListFromMode("all"), ["codex", "claude", "copilot", "opencode"]);
});

test("global CLI installation is offered after interactive installs and updates", () => {
  assert.equal(shouldOfferGlobalCliInstall(parseArgs([]), true), true);
  assert.equal(shouldOfferGlobalCliInstall(parseArgs([]), false), false);
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["--yes"]), true),
    false
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update"]), true),
    true
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update"]), false),
    false
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update", "--yes"]), true),
    false
  );
  assert.equal(isGlobalCliInstallConfirmed("y"), true);
  assert.equal(isGlobalCliInstallConfirmed(" YES "), true);
  assert.equal(isGlobalCliInstallConfirmed(""), false);
  assert.equal(isGlobalCliInstallConfirmed("no"), false);
  assert.equal(
    getGlobalCliInstallCommand("0.9.0"),
    "npm install --global create-ai-blueprint@0.9.0"
  );
  assert.equal(
    getGlobalCliPrompt("install", null, "0.12.0"),
    "\nInstall the optional global `blueprint` CLI command?\n" +
      "This adds the shorter `blueprint status` and `blueprint dashboard` commands.\n" +
      "Without it, use:\n" +
      "  npx create-ai-blueprint@latest status\n" +
      "  npx create-ai-blueprint@latest dashboard\n" +
      "This runs: npm install --global create-ai-blueprint@0.12.0\n" +
      "Continue? [y/N]: "
  );
  assert.equal(
    getGlobalCliPrompt("update", "0.11.1", "0.12.0"),
    "\nUpdate the optional global `blueprint` CLI from 0.11.1 to 0.12.0?\n" +
      "This adds the shorter `blueprint status` and `blueprint dashboard` commands.\n" +
      "Without it, use:\n" +
      "  npx create-ai-blueprint@latest status\n" +
      "  npx create-ai-blueprint@latest dashboard\n" +
      "This runs: npm install --global create-ai-blueprint@0.12.0\n" +
      "Continue? [y/N]: "
  );
  assert.equal(selectGlobalCliAction(null, "0.11.0"), "install");
  assert.equal(selectGlobalCliAction("0.10.0", "0.11.0"), "update");
  assert.equal(selectGlobalCliAction("0.11.0", "0.11.0"), null);
});

test("new installs record only Blueprint-owned managed files", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  await writeFiles(targetDir, {
    "AGENTS.md": "Project instructions\n",
    "blueprint/build-plan.md": "Project roadmap\n"
  });

  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });

  assert.deepEqual(manifest.adapters, ["codex"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".agents/skills/check/SKILL.md"
  ]);
  assert.equal(
    await fs.readFile(path.join(targetDir, CONTROL_DIR, ".gitignore"), "utf8"),
    "backups/\nstaging/\n"
  );
  assert.equal((await readManifest(targetDir))?.version, "1.0.0");
  await assert.rejects(fs.access(path.join(targetDir, ".ai-blueprint")), {
    code: "ENOENT"
  });
  assert.equal(
    await fs.readFile(path.join(targetDir, "blueprint/build-plan.md"), "utf8"),
    "Project roadmap\n"
  );
});

test("Copilot manifests remain distinct from Codex when they share skills", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "copilot"
  });

  assert.deepEqual(manifest.adapters, ["copilot"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".agents/skills/check/SKILL.md"
  ]);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(prepared.adapters, ["copilot"]);
});

test("OpenCode installs its own skills tree and stays distinct in the manifest", async (t) => {
  assert.deepEqual(getTemplateEntries("opencode").map((entry) => entry.target), [
    "AGENTS.md",
    "blueprint",
    ".opencode"
  ]);

  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const files = {
    ".opencode/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "opencode"
  });

  assert.deepEqual(manifest.adapters, ["opencode"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".opencode/skills/check/SKILL.md"
  ]);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(prepared.adapters, ["opencode"]);
});

test("updates preserve pre-Copilot Codex and Claude manifests", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".claude/skills/check/SKILL.md": "Check skill\n",
    ".opencode/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  const allManifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "all"
  });
  await fs.writeFile(
    path.join(targetDir, MANIFEST_PATH),
    `${JSON.stringify({ ...allManifest, adapters: ["claude", "codex"] }, null, 2)}\n`
  );

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(prepared.adapters, ["claude", "codex"]);
  assert.deepEqual(prepared.desiredManifest.adapters, ["claude", "codex"]);

  await applyPreparedUpdate(prepared);

  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "codex"]);
});

test("update replaces unchanged managed files and preserves project files", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Old check skill\n"
  };

  await writeFiles(templateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeFiles(targetDir, {
    "AGENTS.md": "Custom project instructions\n",
    "blueprint/build-plan.md": "Custom roadmap\n",
    "blueprint/context/decisions.md": "Keep this decision\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });

  await writeFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "New check skill\n",
    ".agents/skills/feature/SKILL.md": "New feature skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(
    prepared.plan.update.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md"]
  );
  assert.deepEqual(
    prepared.plan.add.map((operation) => operation.path),
    [".agents/skills/feature/SKILL.md"]
  );
  assert.equal(prepared.plan.conflicts.length, 0);

  const result = await applyPreparedUpdate(prepared, {
    now: () => new Date("2026-07-15T12:00:00Z")
  });

  assert.equal(result.updated, 1);
  assert.equal(result.added, 1);
  assert.ok(result.backupDir);
  assert.match(
    path.relative(targetDir, result.backupDir).replaceAll(path.sep, "/"),
    /^blueprint\/\.state\/backups\/2026-07-15T12-00-00Z-1\.0\.0-to-1\.1\.0-[a-f0-9]{8}$/
  );
  assert.ok(result.backupDir);
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "New check skill\n"
  );
  assert.ok(result.backupDir);
  assert.equal(
    await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8"),
    "Custom project instructions\n"
  );
  assert.ok(result.backupDir);
  assert.equal(
    await fs.readFile(path.join(targetDir, "blueprint/build-plan.md"), "utf8"),
    "Custom roadmap\n"
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "blueprint/context/decisions.md"), "utf8"),
    "Keep this decision\n"
  );
  assert.equal(
    await fs.readFile(
      path.join(result.backupDir, "files/.agents/skills/check/SKILL.md"),
      "utf8"
    ),
    "Old check skill\n"
  );
  assert.equal((await readManifest(targetDir))?.version, "1.1.0");
});

test("local changes to managed files require explicit replacement and are backed up", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Old check skill\n"
  };

  await writeFiles(templateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await writeFiles(targetDir, {
    ".agents/skills/check/SKILL.md": "Locally customized skill\n"
  });
  await writeFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "Upstream skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(
    prepared.plan.conflicts.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md"]
  );
  await assert.rejects(
    applyPreparedUpdate(prepared),
    /must be resolved or explicitly replaced/
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Locally customized skill\n"
  );

  const result = await applyPreparedUpdate(prepared, {
    replaceConflicts: true
  });
  assert.ok(result.backupDir);

  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Upstream skill\n"
  );
  assert.equal(
    await fs.readFile(
      path.join(result.backupDir, "files/.agents/skills/check/SKILL.md"),
      "utf8"
    ),
    "Locally customized skill\n"
  );
});

test("update removes only obsolete managed files that remain unchanged", async (t) => {
  const workspace = await createWorkspace(t);
  const oldTemplateRoot = path.join(workspace, "template-old");
  const newTemplateRoot = path.join(workspace, "template-new");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".agents/skills/retired/SKILL.md": "Retired skill\n"
  };

  await writeFiles(oldTemplateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot: oldTemplateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await writeFiles(newTemplateRoot, {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot: newTemplateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(
    prepared.plan.remove.map((operation) => operation.path),
    [".agents/skills/retired/SKILL.md"]
  );
  const result = await applyPreparedUpdate(prepared);
  assert.ok(result.backupDir);
  await assert.rejects(
    fs.access(path.join(targetDir, ".agents/skills/retired/SKILL.md")),
    { code: "ENOENT" }
  );
  assert.equal(
    await fs.readFile(
      path.join(result.backupDir, "files/.agents/skills/retired/SKILL.md"),
      "utf8"
    ),
    "Retired skill\n"
  );
});

test("update removes an unchanged Blueprint README installed by an older version", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const readmeContent = "Legacy Blueprint docs\n";
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, {
    ...files,
    "blueprint/README.md": readmeContent
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await addManagedFileToManifest(
    targetDir,
    "blueprint/README.md",
    readmeContent
  );

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(
    prepared.plan.remove.map((operation) => operation.path),
    ["blueprint/README.md"]
  );
  const result = await applyPreparedUpdate(prepared);
  assert.equal(result.removed, 1);
  assert.ok(result.backupDir);
  await assert.rejects(fs.access(path.join(targetDir, "blueprint/README.md")), {
    code: "ENOENT"
  });
});

test("update preserves a locally modified legacy Blueprint README", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const readmeContent = "Legacy Blueprint docs\n";
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, files);
  await writeFiles(targetDir, {
    ...files,
    "blueprint/README.md": readmeContent
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await addManagedFileToManifest(
    targetDir,
    "blueprint/README.md",
    readmeContent
  );
  await writeFiles(targetDir, {
    "blueprint/README.md": "Locally customized docs\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(
    prepared.plan.conflicts.map((operation) => operation.path),
    ["blueprint/README.md"]
  );
  await assert.rejects(
    applyPreparedUpdate(prepared),
    /must be resolved or explicitly replaced/
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "blueprint/README.md"), "utf8"),
    "Locally customized docs\n"
  );
});

test("legacy installs treat differing managed files as conflicts", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "Current check skill\n"
  });
  await writeFiles(targetDir, {
    "blueprint/README.md": "Current Blueprint docs\n",
    ".agents/skills/check/SKILL.md": "Legacy customized skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.equal(prepared.previousVersion, "legacy");
  assert.deepEqual(
    prepared.plan.conflicts.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md"]
  );
  assert.equal(prepared.plan.unchanged.length, 0);
  assert.equal(
    await fs.readFile(path.join(targetDir, "blueprint/README.md"), "utf8"),
    "Current Blueprint docs\n"
  );
});

test("update aborts when a managed file changes after the plan is created", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Old check skill\n"
  };

  await writeFiles(templateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await writeFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "New check skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });
  await writeFiles(targetDir, {
    ".agents/skills/check/SKILL.md": "Changed after preview\n"
  });

  await assert.rejects(
    applyPreparedUpdate(prepared),
    /Managed path changed after the update plan was created/
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Changed after preview\n"
  );
  assert.equal((await readManifest(targetDir))?.version, "1.0.0");
});

test("failed apply removes additions and restores the previous manifest", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeFiles(templateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapter: "codex"
  });
  await writeFiles(templateRoot, {
    ".agents/skills/feature/SKILL.md": "Feature skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });
  const originalRename = fs.rename;
  let injectedFailure = false;

  fs.rename = async (source, target) => {
    if (!injectedFailure && target === path.join(targetDir, MANIFEST_PATH)) {
      injectedFailure = true;
      const error = Object.assign(new Error("injected manifest failure"), { code: "EIO" });
      throw error;
    }

    return originalRename(source, target);
  };

  try {
    await assert.rejects(
      applyPreparedUpdate(prepared),
      /Blueprint update failed and was rolled back/
    );
  } finally {
    fs.rename = originalRename;
  }

  await assert.rejects(
    fs.access(path.join(targetDir, ".agents/skills/feature/SKILL.md")),
    { code: "ENOENT" }
  );
  assert.equal((await readManifest(targetDir))?.version, "1.0.0");
});

test("update refuses to write through a symbolic-link directory", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const outsideDir = path.join(workspace, "outside");

  await writeFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "Current check skill\n"
  });
  await fs.mkdir(targetDir, { recursive: true });
  await writeFiles(outsideDir, {
    "skills/check/SKILL.md": "Outside skill\n"
  });
  await fs.symlink(outsideDir, path.join(targetDir, ".agents"));

  await assert.rejects(
    prepareUpdate({ targetDir, templateRoot, version: "1.1.0" }),
    /Refusing to write through symbolic-link directory/
  );
});

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "ai-blueprint-update-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return workspace;
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, ...relativePath.split("/"));
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  }
}

async function addManagedFileToManifest(
  targetDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const manifest = await readManifest(targetDir);

  if (!manifest) {
    throw new Error("Expected manifest before adding a legacy managed file");
  }

  manifest.managedFiles[relativePath] = crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");
  await fs.writeFile(
    path.join(targetDir, MANIFEST_PATH),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}
