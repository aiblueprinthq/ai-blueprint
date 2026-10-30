import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADAPTER_PROMPT,
  findPackageRoot,
  formatMissingTemplateMessage,
  getTemplateEntries,
  getGlobalCliInstallCommand,
  getGlobalCliPrompt,
  isGlobalCliInstallConfirmed,
  parseArgs,
  resolveAdapters,
  resolveUpdateAdapters,
  selectGlobalCliAction,
  shouldOfferGlobalCliInstall
} from "../bin/create-ai-blueprint.js";
import {
  CONTROL_DIR,
  MANIFEST_PATH,
  adapterListFromMode,
  applyPreparedUpdate,
  findStaleClaudeImports,
  prepareUpdate,
  readInstalledAdapters,
  readManifest,
  writeInstallManifest
} from "../lib/update.js";

const WORKFLOW_PATH = "blueprint/workflow.md";
const WORKFLOW_CONTENT = "Workflow reference\n";

test("CLI recovery recognizes every shipped AI skill without reading a project", async () => {
  const skillsRoot = fileURLToPath(new URL("../../../.agents/skills/", import.meta.url));
  const skills = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const skill of skills.filter((entry) => entry.isDirectory())) {
    if (skill.name === "status") {
      assert.equal(parseArgs([skill.name]).command, "status");
      continue;
    }
    assert.throws(() => parseArgs([skill.name]), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(`\`$${skill.name}\` in Codex`));
      assert.ok(error.message.includes(`\`/${skill.name}\` in Claude Code`));
      return true;
    });
  }
  assert.equal(parseArgs(["status", "--target", "doctor"]).target, "doctor");
});

test("retired browser-tests CLI input points to consolidated AI chat commands", () => {
  for (const surface of ["global", "package"] as const) {
    assert.throws(() => parseArgs(["browser-tests"], surface), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /skill was removed/);
      assert.ok(error.message.includes("`$tests browser` in Codex"));
      assert.ok(error.message.includes("`/tests browser` in Claude Code"));
      return true;
    });
  }
});

test("retired try CLI input points to consolidated AI chat commands", () => {
  for (const surface of ["global", "package"] as const) {
    assert.throws(() => parseArgs(["try"], surface), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /skill was removed/);
      assert.ok(error.message.includes("`$check guide` in Codex"));
      assert.ok(error.message.includes("`/check guide` in Claude Code"));
      return true;
    });
  }
});

test("parseArgs supports install and update modes", () => {
  assert.equal(
    ADAPTER_PROMPT,
    "Select AI tool adapters"
  );
  assert.equal(parseArgs([]).command, "install");
  assert.deepEqual(parseArgs(["update", "--dry-run"]), {
    adapters: null,
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
    adapters: null,
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
  assert.deepEqual(parseArgs(["update", "--codex"]).adapters, ["codex"]);
  assert.deepEqual(parseArgs(["update", "--all"]).adapters, [
    "codex",
    "claude",
    "copilot",
    "opencode",
    "antigravity"
  ]);
  assert.deepEqual(parseArgs(["dashboard", "--no-open", "--target", "./app"]), {
    adapters: null,
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
    adapters: null,
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
  assert.deepEqual(parseArgs(["--copilot"]).adapters, ["copilot"]);
  assert.deepEqual(parseArgs(["--antigravity"]).adapters, ["antigravity"]);
  assert.deepEqual(parseArgs(["--codex", "--opencode"]).adapters, [
    "codex",
    "opencode"
  ]);
  assert.deepEqual(parseArgs(["--all"]).adapters, [
    "codex",
    "claude",
    "copilot",
    "opencode",
    "antigravity"
  ]);
  assert.throws(
    () => parseArgs(["--all", "--opencode"]),
    /Do not combine --all or --both/
  );
  assert.deepEqual(parseArgs(["--both"]), {
    adapters: ["codex", "claude", "copilot", "opencode", "antigravity"],
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

test("shared adapters reuse compatible skill trees", () => {
  assert.deepEqual(
    getTemplateEntries(["copilot"]).map((entry) => entry.target),
    ["AGENTS.md", "blueprint", ".agents"]
  );
  assert.deepEqual(
    getTemplateEntries(["opencode"]).map((entry) => entry.target),
    ["AGENTS.md", "blueprint", ".agents"]
  );
  assert.deepEqual(
    getTemplateEntries(["antigravity"]).map((entry) => entry.target),
    ["AGENTS.md", "blueprint", ".agents"]
  );
  assert.deepEqual(
    getTemplateEntries(["claude", "opencode"]).map((entry) => entry.target),
    ["AGENTS.md", "blueprint", "CLAUDE.md", ".claude"]
  );
  assert.deepEqual(
    getTemplateEntries(["codex", "claude", "copilot", "opencode", "antigravity"]).map(
      (entry) => entry.target
    ),
    ["AGENTS.md", "blueprint", ".agents", "CLAUDE.md", ".claude"]
  );
  assert.deepEqual(adapterListFromMode("all"), [
    "codex",
    "claude",
    "copilot",
    "opencode",
    "antigravity"
  ]);
});

test("interactive installs default to Claude Code and Codex", async () => {
  let receivedConfig: unknown = null;
  const options = parseArgs([]);
  const selected = await resolveAdapters(
    options,
    async (config) => {
      receivedConfig = config;
      return ["codex", "opencode"];
    },
    true
  );

  assert.deepEqual(selected, ["codex", "opencode"]);
  assert.deepEqual(receivedConfig, {
    message: "Select AI tool adapters",
    choices: [
      { name: "Codex", value: "codex", checked: true },
      { name: "Claude Code", value: "claude", checked: true },
      { name: "GitHub Copilot", value: "copilot", checked: false },
      { name: "OpenCode", value: "opencode", checked: false },
      { name: "Google Antigravity", value: "antigravity", checked: false }
    ],
    required: true
  });
});

test("update adapter flags add to the installed set and the prompt starts from it", async () => {
  assert.deepEqual(
    await resolveUpdateAdapters(parseArgs(["update", "--codex"]), ["claude"]),
    ["claude", "codex"]
  );
  assert.deepEqual(
    await resolveUpdateAdapters(parseArgs(["update", "--claude"]), ["claude", "codex"]),
    ["claude", "codex"]
  );
  assert.deepEqual(
    await resolveUpdateAdapters(parseArgs(["update", "--yes"]), ["claude"], undefined, true),
    ["claude"]
  );
  assert.deepEqual(
    await resolveUpdateAdapters(parseArgs(["update"]), ["copilot"], undefined, false),
    ["copilot"]
  );

  let receivedConfig: unknown = null;
  const selected = await resolveUpdateAdapters(
    parseArgs(["update"]),
    ["claude", "opencode"],
    async (config) => {
      receivedConfig = config;
      return ["codex", "opencode"];
    },
    true
  );

  assert.deepEqual(selected, ["codex", "opencode"]);
  assert.deepEqual(receivedConfig, {
    message: "Select AI tool adapters",
    choices: [
      { name: "Codex", value: "codex", checked: false },
      { name: "Claude Code", value: "claude", checked: true },
      { name: "GitHub Copilot", value: "copilot", checked: false },
      { name: "OpenCode", value: "opencode", checked: true },
      { name: "Google Antigravity", value: "antigravity", checked: false }
    ],
    required: true
  });
});

test("global CLI installation is offered for published interactive installs and updates", () => {
  assert.equal(shouldOfferGlobalCliInstall(parseArgs([]), true), false);
  assert.equal(shouldOfferGlobalCliInstall(parseArgs([]), true, false), true);
  assert.equal(shouldOfferGlobalCliInstall(parseArgs([]), false, false), false);
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["--yes"]), true, false),
    false
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update"]), true, false),
    true
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update"]), false, false),
    false
  );
  assert.equal(
    shouldOfferGlobalCliInstall(parseArgs(["update", "--yes"]), true, false),
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

  await writeTemplateFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  await writeFiles(targetDir, {
    "AGENTS.md": "Project instructions\n",
    "blueprint/build-plan.md": "Project roadmap\n"
  });

  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });

  assert.deepEqual(manifest.adapters, ["codex"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".agents/skills/check/SKILL.md",
    WORKFLOW_PATH
  ]);
  assert.equal(
    await fs.readFile(path.join(targetDir, CONTROL_DIR, ".gitignore"), "utf8"),
    "backups/\nstaging/\nrun.json\n"
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

  await writeTemplateFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["copilot"]
  });

  assert.deepEqual(manifest.adapters, ["copilot"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".agents/skills/check/SKILL.md",
    WORKFLOW_PATH
  ]);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(prepared.adapters, ["copilot"]);
});

test("OpenCode manifests reuse one compatible skill tree", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".claude/skills/check/SKILL.md": "Check skill\n"
  });
  await writeFiles(targetDir, {
    ".claude/skills/check/SKILL.md": "Check skill\n"
  });

  const manifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["claude", "opencode"]
  });

  assert.deepEqual(manifest.adapters, ["claude", "opencode"]);
  assert.deepEqual(Object.keys(manifest.managedFiles), [
    ".claude/skills/check/SKILL.md",
    WORKFLOW_PATH
  ]);
});

test("updates preserve pre-Copilot Codex and Claude manifests", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".claude/skills/check/SKILL.md": "Check skill\n"
  };

  await writeTemplateFiles(templateRoot, files);
  await writeFiles(targetDir, files);
  const allManifest = await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex", "claude", "copilot", "opencode"]
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

test("updates report obsolete Claude imports without changing CLAUDE.md", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const skillPath = ".claude/skills/feature/SKILL.md";
  const oldClaudeFile = [
    "# Project",
    "",
    "@AGENTS.md",
    "@blueprint/context/project-overview.md",
    "@blueprint/context/coding-standards.md",
    "@blueprint/context/ai-interaction.md",
    "@blueprint/context/current-feature.md",
    ""
  ].join("\n");

  await writeTemplateFiles(templateRoot, { [skillPath]: "Old feature skill\n" });
  await writeInstalledFiles(targetDir, {
    [skillPath]: "Old feature skill\n",
    "CLAUDE.md": oldClaudeFile
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.3.0",
    adapters: ["claude"]
  });
  await writeTemplateFiles(templateRoot, { [skillPath]: "New feature skill\n" });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.5.0"
  });

  assert.deepEqual(prepared.staleClaudeImports, [
    "@blueprint/context/project-overview.md",
    "@blueprint/context/current-feature.md",
    "@blueprint/context/coding-standards.md",
    "@blueprint/context/ai-interaction.md"
  ]);
  assert.deepEqual(
    await findStaleClaudeImports(targetDir, ["claude"]),
    prepared.staleClaudeImports
  );

  await applyPreparedUpdate(prepared);

  assert.equal(await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf8"), oldClaudeFile);
});

test("update replaces unchanged managed files and preserves project files", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Old check skill\n"
  };

  await writeTemplateFiles(templateRoot, oldFiles);
  await writeFiles(targetDir, oldFiles);
  await writeInstalledFiles(targetDir, {
    "AGENTS.md": "Custom project instructions\n",
    "blueprint/build-plan.md": "Custom roadmap\n",
    "blueprint/config.json": "{\"schemaVersion\":1}\n",
    "blueprint/context/decisions.md": "Keep this decision\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });

  await writeTemplateFiles(templateRoot, {
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
    path.relative(prepared.targetDir, result.backupDir).replaceAll(path.sep, "/"),
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
    await fs.readFile(path.join(targetDir, "blueprint/config.json"), "utf8"),
    "{\"schemaVersion\":1}\n"
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

test("update adds the managed workflow reference to installs that predate it", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const skills = { ".agents/skills/check/SKILL.md": "Check skill\n" };

  await writeTemplateFiles(templateRoot, skills);
  await writeFiles(targetDir, { ...skills, "AGENTS.md": "Monolithic project instructions\n" });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });
  const manifest = await readManifest(targetDir);
  assert.ok(manifest);
  delete manifest.managedFiles[WORKFLOW_PATH];
  await fs.writeFile(path.join(targetDir, MANIFEST_PATH), `${JSON.stringify(manifest, null, 2)}\n`);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0"
  });

  assert.deepEqual(prepared.plan.add.map((operation) => operation.path), [WORKFLOW_PATH]);
  assert.equal(prepared.plan.conflicts.length, 0);

  await applyPreparedUpdate(prepared);

  assert.equal(await fs.readFile(path.join(targetDir, WORKFLOW_PATH), "utf8"), WORKFLOW_CONTENT);
  assert.equal(
    await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8"),
    "Monolithic project instructions\n"
  );
  assert.ok((await readManifest(targetDir))?.managedFiles[WORKFLOW_PATH]);
});

test("local changes to managed files require explicit replacement and are backed up", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const oldFiles = {
    ".agents/skills/check/SKILL.md": "Old check skill\n"
  };

  await writeTemplateFiles(templateRoot, oldFiles);
  await writeInstalledFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });
  await writeFiles(targetDir, {
    ".agents/skills/check/SKILL.md": "Locally customized skill\n"
  });
  await writeTemplateFiles(templateRoot, {
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

  await writeTemplateFiles(oldTemplateRoot, oldFiles);
  await writeInstalledFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot: oldTemplateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });
  await writeTemplateFiles(newTemplateRoot, {
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

for (const customized of [false, true]) {
  test(`consolidated test setup ${customized ? "preserves customized" : "removes unchanged"} retired skills in both adapters`, async (t) => {
    const workspace = await createWorkspace(t);
    const oldTemplateRoot = path.join(workspace, "template-old");
    const newTemplateRoot = path.join(workspace, "template-new");
    const targetDir = path.join(workspace, "target");
    const oldFiles: Record<string, string> = { "AGENTS.md": "Project-owned instructions\n" };
    const newFiles: Record<string, string> = {};
    const retiredPaths: string[] = [];
    for (const adapter of [".agents", ".claude"]) {
      const retired = `${adapter}/skills/browser-tests/SKILL.md`;
      retiredPaths.push(retired);
      oldFiles[retired] = "Old browser setup\n";
      oldFiles[`${adapter}/skills/tests/SKILL.md`] = "Old unit setup\n";
      for (const file of ["SKILL.md", "reference/unit.md", "reference/browser.md"]) {
        const relative = `${adapter}/skills/tests/${file}`;
        newFiles[relative] = await fs.readFile(
          new URL(`../../../${relative}`, import.meta.url), "utf8"
        );
      }
    }
    await writeTemplateFiles(oldTemplateRoot, oldFiles);
    await writeInstalledFiles(targetDir, oldFiles);
    await writeInstallManifest({
      targetDir, templateRoot: oldTemplateRoot, version: "1.0.0", adapters: ["codex", "claude"]
    });
    if (customized) {
      await writeFiles(targetDir, Object.fromEntries(
        retiredPaths.map((relative) => [relative, "Customized browser setup\n"])
      ));
    }
    await writeTemplateFiles(newTemplateRoot, newFiles);
    const prepared = await prepareUpdate({
      targetDir, templateRoot: newTemplateRoot, version: "1.1.0"
    });
    if (customized) {
      assert.deepEqual(
        prepared.plan.conflicts.map(({ path: file, operation, reason }) => [file, operation, reason]),
        retiredPaths.map((file) => [file, "remove", "obsolete managed file was modified locally"])
      );
      await assert.rejects(applyPreparedUpdate(prepared), /must be resolved or explicitly replaced/);
      for (const relative of retiredPaths) {
        assert.equal(await fs.readFile(path.join(targetDir, relative), "utf8"), "Customized browser setup\n");
      }
      assert.equal(await fs.readFile(path.join(targetDir, ".agents/skills/tests/SKILL.md"), "utf8"), "Old unit setup\n");
    } else {
      assert.equal(prepared.plan.conflicts.length, 0);
      assert.deepEqual(prepared.plan.remove.map(({ path: file }) => file), retiredPaths);
      const result = await applyPreparedUpdate(prepared);
      assert.ok(result.backupDir);
      for (const relative of retiredPaths) {
        await assert.rejects(fs.access(path.join(targetDir, relative)), { code: "ENOENT" });
        assert.equal(await fs.readFile(path.join(result.backupDir, "files", relative), "utf8"), oldFiles[relative]);
      }
      for (const [relative, content] of Object.entries(newFiles)) {
        assert.equal(await fs.readFile(path.join(targetDir, relative), "utf8"), content);
      }
    }
    assert.equal(await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8"), oldFiles["AGENTS.md"]);
  });
}

for (const customized of [false, true]) {
  test(`check guide ${customized ? "preserves customized" : "removes unchanged"} retired skills in both adapters`, async (t) => {
    const workspace = await createWorkspace(t);
    const oldTemplateRoot = path.join(workspace, "template-old");
    const newTemplateRoot = path.join(workspace, "template-new");
    const targetDir = path.join(workspace, "target");
    const oldFiles: Record<string, string> = { "AGENTS.md": "Project-owned instructions\n" };
    const newFiles: Record<string, string> = {};
    const retiredPaths: string[] = [];
    for (const adapter of [".agents", ".claude"]) {
      const retired = `${adapter}/skills/try/SKILL.md`;
      retiredPaths.push(retired);
      oldFiles[retired] = "Old manual guide\n";
      oldFiles[`${adapter}/skills/check/SKILL.md`] = "Old verification\n";
      for (const file of ["SKILL.md", "reference/verify.md", "reference/guide.md"]) {
        const relative = `${adapter}/skills/check/${file}`;
        newFiles[relative] = await fs.readFile(
          new URL(`../../../${relative}`, import.meta.url), "utf8"
        );
      }
    }
    await writeTemplateFiles(oldTemplateRoot, oldFiles);
    await writeInstalledFiles(targetDir, oldFiles);
    await writeInstallManifest({
      targetDir, templateRoot: oldTemplateRoot, version: "1.0.0", adapters: ["codex", "claude"]
    });
    if (customized) {
      await writeFiles(targetDir, Object.fromEntries(
        retiredPaths.map((relative) => [relative, "Customized manual guide\n"])
      ));
    }
    await writeTemplateFiles(newTemplateRoot, newFiles);
    const prepared = await prepareUpdate({
      targetDir, templateRoot: newTemplateRoot, version: "1.1.0"
    });
    if (customized) {
      assert.deepEqual(
        prepared.plan.conflicts.map(({ path: file, operation, reason }) => [file, operation, reason]),
        retiredPaths.map((file) => [file, "remove", "obsolete managed file was modified locally"])
      );
      await assert.rejects(applyPreparedUpdate(prepared), /must be resolved or explicitly replaced/);
      for (const relative of retiredPaths) {
        assert.equal(await fs.readFile(path.join(targetDir, relative), "utf8"), "Customized manual guide\n");
      }
      assert.equal(await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"), "Old verification\n");
    } else {
      assert.equal(prepared.plan.conflicts.length, 0);
      assert.deepEqual(prepared.plan.remove.map(({ path: file }) => file), retiredPaths);
      const result = await applyPreparedUpdate(prepared);
      assert.ok(result.backupDir);
      for (const relative of retiredPaths) {
        await assert.rejects(fs.access(path.join(targetDir, relative)), { code: "ENOENT" });
        assert.equal(await fs.readFile(path.join(result.backupDir, "files", relative), "utf8"), oldFiles[relative]);
      }
      for (const [relative, content] of Object.entries(newFiles)) {
        assert.equal(await fs.readFile(path.join(targetDir, relative), "utf8"), content);
      }
    }
    assert.equal(await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8"), oldFiles["AGENTS.md"]);
  });
}

test("update removes an unchanged Blueprint README installed by an older version", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const readmeContent = "Legacy Blueprint docs\n";
  const files = {
    ".agents/skills/check/SKILL.md": "Check skill\n"
  };

  await writeTemplateFiles(templateRoot, files);
  await writeInstalledFiles(targetDir, {
    ...files,
    "blueprint/README.md": readmeContent
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
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

  await writeTemplateFiles(templateRoot, files);
  await writeInstalledFiles(targetDir, {
    ...files,
    "blueprint/README.md": readmeContent
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
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

  await writeTemplateFiles(templateRoot, {
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

  await writeTemplateFiles(templateRoot, oldFiles);
  await writeInstalledFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });
  await writeTemplateFiles(templateRoot, {
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

  await writeTemplateFiles(templateRoot, oldFiles);
  await writeInstalledFiles(targetDir, oldFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });
  await writeTemplateFiles(templateRoot, {
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
    if (!injectedFailure && target === path.join(prepared.targetDir, MANIFEST_PATH)) {
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

  await writeTemplateFiles(templateRoot, {
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

test("findPackageRoot walks up to the nearest package.json", async (t: TestContext) => {
  const workspace = await createWorkspace(t);
  const nested = path.join(workspace, "pkg", "dist", "bin");
  await fs.mkdir(nested, { recursive: true });
  await writeFiles(workspace, {
    "package.json": '{ "name": "outer-workspace" }\n',
    "pkg/package.json": '{ "name": "nested-package" }\n'
  });

  const packageRoot = path.join(workspace, "pkg");
  assert.equal(findPackageRoot(nested), packageRoot);
  assert.equal(findPackageRoot(path.join(packageRoot, "bin")), packageRoot);
  assert.equal(findPackageRoot(packageRoot), packageRoot);
});

test("findPackageRoot resolves this checkout to the installer package", () => {
  const packageRoot = path.resolve(import.meta.dirname, "..");

  assert.equal(findPackageRoot(path.join(packageRoot, "bin")), packageRoot);
  assert.equal(
    findPackageRoot(path.join(packageRoot, "dist", "bin")),
    packageRoot
  );
  assert.notEqual(findPackageRoot(path.join(packageRoot, "bin")), path.dirname(packageRoot));
});

test("formatMissingTemplateMessage names the directory it searched", () => {
  const searched = path.join("some", "where", "template");
  const message = formatMissingTemplateMessage(searched);

  assert.match(message, /Installer template is missing/);
  assert.ok(message.includes(searched));
  assert.match(message, /npm run link:local/);
  assert.match(message, /npm run prepare-template/);
});

const adapterChangeTemplate = {
  "CLAUDE.md": "# Project\n\n@AGENTS.md\n",
  ".agents/skills/check/SKILL.md": "Check skill\n",
  ".agents/skills/feature/SKILL.md": "Feature skill\n",
  ".claude/skills/check/SKILL.md": "Check skill\n",
  ".claude/skills/feature/SKILL.md": "Feature skill\n"
};

test("update adds an adapter by installing its missing skill tree", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, {
    "CLAUDE.md": "# Custom\n\n@AGENTS.md\n",
    ".claude/skills/check/SKILL.md": "Check skill\n",
    ".claude/skills/feature/SKILL.md": "Feature skill\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["claude"]
  });

  assert.deepEqual(await readInstalledAdapters(targetDir), ["claude"]);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex"]
  });

  assert.deepEqual(prepared.previousAdapters, ["claude"]);
  assert.deepEqual(prepared.adapters, ["claude", "codex"]);
  assert.deepEqual(prepared.addedAdapters, ["codex"]);
  assert.deepEqual(prepared.removedAdapters, []);
  assert.equal(prepared.claudeEntrypoint, null);
  assert.deepEqual(
    prepared.plan.add.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md", ".agents/skills/feature/SKILL.md"]
  );
  assert.equal(prepared.plan.remove.length, 0);
  assert.equal(prepared.plan.conflicts.length, 0);

  const result = await applyPreparedUpdate(prepared);

  assert.equal(result.added, 2);
  assert.equal(result.createdClaudeEntrypoint, false);
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Check skill\n"
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/feature/SKILL.md"), "utf8"),
    "Feature skill\n"
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf8"),
    "# Custom\n\n@AGENTS.md\n"
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "codex"]);
});

test("update removes an adapter's skill tree and keeps CLAUDE.md", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const { "CLAUDE.md": claudeFile, ...skills } = adapterChangeTemplate;

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, { ...skills, "CLAUDE.md": claudeFile });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["claude", "codex"]
  });
  await writeFiles(targetDir, {
    ".claude/skills/feature/SKILL.md": "Locally customized feature skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["codex"]
  });

  assert.deepEqual(prepared.addedAdapters, []);
  assert.deepEqual(prepared.removedAdapters, ["claude"]);
  assert.equal(prepared.claudeEntrypoint, null);
  assert.equal(prepared.plan.add.length, 0);
  assert.deepEqual(
    prepared.plan.remove.map((operation) => operation.path),
    [".claude/skills/check/SKILL.md"]
  );
  assert.deepEqual(
    prepared.plan.conflicts.map((operation) => [operation.path, operation.operation, operation.reason]),
    [[".claude/skills/feature/SKILL.md", "remove", "obsolete managed file was modified locally"]]
  );
  await assert.rejects(
    applyPreparedUpdate(prepared),
    /must be resolved or explicitly replaced/
  );

  const result = await applyPreparedUpdate(prepared, { replaceConflicts: true });

  assert.equal(result.removed, 2);
  assert.ok(result.backupDir);
  assert.equal(
    await fs.readFile(
      path.join(result.backupDir, "files/.claude/skills/feature/SKILL.md"),
      "utf8"
    ),
    "Locally customized feature skill\n"
  );
  await assert.rejects(fs.access(path.join(targetDir, ".claude")), { code: "ENOENT" });
  assert.equal(await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf8"), claudeFile);
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Check skill\n"
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["codex"]);
});

test("adding Claude Code creates CLAUDE.md only when it is missing", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const codexFiles = {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".agents/skills/feature/SKILL.md": "Feature skill\n"
  };

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, codexFiles);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex"]
  });

  assert.deepEqual(prepared.addedAdapters, ["claude"]);
  assert.equal(prepared.claudeEntrypoint, "create");
  assert.deepEqual(
    prepared.plan.add.map((operation) => operation.path),
    [".claude/skills/check/SKILL.md", ".claude/skills/feature/SKILL.md"]
  );

  const result = await applyPreparedUpdate(prepared);

  assert.equal(result.createdClaudeEntrypoint, true);
  assert.equal(
    await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf8"),
    adapterChangeTemplate["CLAUDE.md"]
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "codex"]);

  const preservedTarget = path.join(workspace, "target-preserved");
  const customClaudeFile = "# Custom\n\n@AGENTS.md\n";

  await writeFiles(preservedTarget, { ...codexFiles, "CLAUDE.md": customClaudeFile });
  await writeInstallManifest({
    targetDir: preservedTarget,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });

  const preservedPrepared = await prepareUpdate({
    targetDir: preservedTarget,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex"]
  });

  assert.equal(preservedPrepared.claudeEntrypoint, "preserve");

  const preservedResult = await applyPreparedUpdate(preservedPrepared);

  assert.equal(preservedResult.createdClaudeEntrypoint, false);
  assert.equal(
    await fs.readFile(path.join(preservedTarget, "CLAUDE.md"), "utf8"),
    customClaudeFile
  );
});

test("OpenCode follows the Claude Code skill tree when adapters change", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, {
    "CLAUDE.md": adapterChangeTemplate["CLAUDE.md"],
    ".claude/skills/check/SKILL.md": "Check skill\n",
    ".claude/skills/feature/SKILL.md": "Feature skill\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["claude"]
  });

  const addOpenCode = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "opencode"]
  });

  assert.deepEqual(addOpenCode.addedAdapters, ["opencode"]);
  assert.equal(addOpenCode.plan.add.length, 0);
  assert.equal(addOpenCode.plan.remove.length, 0);

  await applyPreparedUpdate(addOpenCode);

  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "opencode"]);
  await assert.rejects(fs.access(path.join(targetDir, ".agents")), { code: "ENOENT" });

  const removeClaude = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["opencode"]
  });

  assert.deepEqual(removeClaude.removedAdapters, ["claude"]);
  assert.deepEqual(
    removeClaude.plan.add.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md", ".agents/skills/feature/SKILL.md"]
  );
  assert.deepEqual(
    removeClaude.plan.remove.map((operation) => operation.path),
    [".claude/skills/check/SKILL.md", ".claude/skills/feature/SKILL.md"]
  );

  await applyPreparedUpdate(removeClaude);

  await assert.rejects(fs.access(path.join(targetDir, ".claude")), { code: "ENOENT" });
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    "Check skill\n"
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "CLAUDE.md"), "utf8"),
    adapterChangeTemplate["CLAUDE.md"]
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["opencode"]);
});

test("legacy installs can add adapters but must update before removing one", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const { "CLAUDE.md": claudeFile, ...skills } = adapterChangeTemplate;

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeFiles(targetDir, { ...skills, "CLAUDE.md": claudeFile });

  assert.deepEqual(await readInstalledAdapters(targetDir), ["codex", "claude"]);
  await assert.rejects(
    prepareUpdate({ targetDir, templateRoot, version: "1.1.0", adapters: ["codex"] }),
    /Run a plain `update` first/
  );
  await assert.rejects(
    prepareUpdate({ targetDir, templateRoot, version: "1.1.0", adapters: [] }),
    /Unknown or empty adapter selection/
  );

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex", "copilot"]
  });

  assert.equal(prepared.previousVersion, "legacy");
  assert.deepEqual(prepared.previousAdapters, ["codex", "claude"]);
  assert.deepEqual(prepared.addedAdapters, ["copilot"]);
  assert.deepEqual(prepared.removedAdapters, []);
  assert.equal(prepared.plan.conflicts.length, 0);
  assert.equal(prepared.plan.unchanged.length, 4);

  await applyPreparedUpdate(prepared);

  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "codex", "copilot"]);
});

test("failed adapter addition prunes the directories it created", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");
  const codexFiles = {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".agents/skills/feature/SKILL.md": "Feature skill\n"
  };

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await fs.rm(path.join(templateRoot, "CLAUDE.md"));
  await writeFiles(targetDir, codexFiles);

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex"]
  });

  assert.equal(prepared.previousVersion, "legacy");
  assert.equal(prepared.claudeEntrypoint, "create");
  await assert.rejects(
    applyPreparedUpdate(prepared),
    /Blueprint update failed and was rolled back/
  );

  await assert.rejects(fs.access(path.join(targetDir, ".claude")), { code: "ENOENT" });
  await assert.rejects(fs.access(path.join(targetDir, "CLAUDE.md")), { code: "ENOENT" });
  assert.equal(await readManifest(targetDir), null);
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/check/SKILL.md"), "utf8"),
    codexFiles[".agents/skills/check/SKILL.md"]
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, ".agents/skills/feature/SKILL.md"), "utf8"),
    codexFiles[".agents/skills/feature/SKILL.md"]
  );
});

test("adding Claude Code moves the OpenCode skill tree to .claude", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, {
    "CLAUDE.md": adapterChangeTemplate["CLAUDE.md"],
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".agents/skills/feature/SKILL.md": "Feature skill\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["opencode"]
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "opencode"]
  });

  assert.deepEqual(prepared.addedAdapters, ["claude"]);
  assert.deepEqual(prepared.removedAdapters, []);
  assert.deepEqual(
    prepared.plan.add.map((operation) => operation.path),
    [".claude/skills/check/SKILL.md", ".claude/skills/feature/SKILL.md"]
  );
  assert.deepEqual(
    prepared.plan.remove.map((operation) => operation.path),
    [".agents/skills/check/SKILL.md", ".agents/skills/feature/SKILL.md"]
  );

  await applyPreparedUpdate(prepared);

  await assert.rejects(fs.access(path.join(targetDir, ".agents")), { code: "ENOENT" });
  assert.equal(
    await fs.readFile(path.join(targetDir, ".claude/skills/check/SKILL.md"), "utf8"),
    "Check skill\n"
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "opencode"]);
});

test("removing Claude Code keeps user-owned files under .claude", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, adapterChangeTemplate);
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["claude", "codex"]
  });
  await writeFiles(targetDir, {
    ".claude/settings.json": "{}\n",
    ".claude/skills/mine/SKILL.md": "My skill\n"
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["codex"]
  });

  assert.deepEqual(prepared.removedAdapters, ["claude"]);
  assert.equal(prepared.plan.conflicts.length, 0);

  await applyPreparedUpdate(prepared);

  assert.equal(await fs.readFile(path.join(targetDir, ".claude/settings.json"), "utf8"), "{}\n");
  assert.equal(
    await fs.readFile(path.join(targetDir, ".claude/skills/mine/SKILL.md"), "utf8"),
    "My skill\n"
  );
  assert.ok((await fs.stat(path.join(targetDir, ".claude/skills"))).isDirectory());
  await assert.rejects(fs.access(path.join(targetDir, ".claude/skills/check")), {
    code: "ENOENT"
  });
  await assert.rejects(fs.access(path.join(targetDir, ".claude/skills/feature")), {
    code: "ENOENT"
  });
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["codex"]);
});

test("adding Claude Code preserves a CLAUDE.md directory", async (t) => {
  const workspace = await createWorkspace(t);
  const templateRoot = path.join(workspace, "template");
  const targetDir = path.join(workspace, "target");

  await writeTemplateFiles(templateRoot, adapterChangeTemplate);
  await writeInstalledFiles(targetDir, {
    ".agents/skills/check/SKILL.md": "Check skill\n",
    ".agents/skills/feature/SKILL.md": "Feature skill\n",
    "CLAUDE.md/notes.md": "Not an entrypoint\n"
  });
  await writeInstallManifest({
    targetDir,
    templateRoot,
    version: "1.0.0",
    adapters: ["codex"]
  });

  const prepared = await prepareUpdate({
    targetDir,
    templateRoot,
    version: "1.1.0",
    adapters: ["claude", "codex"]
  });

  assert.equal(prepared.claudeEntrypoint, "preserve");

  const result = await applyPreparedUpdate(prepared);

  assert.equal(result.createdClaudeEntrypoint, false);
  assert.ok((await fs.lstat(path.join(targetDir, "CLAUDE.md"))).isDirectory());
  assert.equal(
    await fs.readFile(path.join(targetDir, "CLAUDE.md/notes.md"), "utf8"),
    "Not an entrypoint\n"
  );
  assert.deepEqual((await readManifest(targetDir))?.adapters, ["claude", "codex"]);
});

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "ai-blueprint-update-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return workspace;
}

async function writeTemplateFiles(root: string, files: Record<string, string>): Promise<void> {
  await writeFiles(root, { [WORKFLOW_PATH]: WORKFLOW_CONTENT, ...files });
}

async function writeInstalledFiles(root: string, files: Record<string, string>): Promise<void> {
  await writeFiles(root, { [WORKFLOW_PATH]: WORKFLOW_CONTENT, ...files });
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
