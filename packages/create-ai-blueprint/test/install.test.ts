import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
const templateFiles = {
  "AGENTS.md": "Blueprint instructions\n",
  "CLAUDE.md": "@AGENTS.md\n",
  "blueprint/config.json": "{}\n",
  "blueprint/project-plan.md": "Starter project plan\n",
  "blueprint/workflow.md": "Workflow reference\n",
  ".agents/skills/check/SKILL.md": "Check skill\n",
  ".claude/skills/check/SKILL.md": "Check skill\n"
};
let workspace: string;
let fixturePackage: string;
let fixtureWithoutTemplate: string;

before(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-install-test-"));
  fixturePackage = path.join(workspace, "package");
  fixtureWithoutTemplate = path.join(workspace, "package-without-template");

  for (const destination of [fixturePackage, fixtureWithoutTemplate]) {
    await fs.mkdir(destination);
    for (const entry of ["bin", "lib", "package.json"]) {
      await fs.cp(path.join(packageRoot, entry), path.join(destination, entry), { recursive: true });
    }
    await fs.symlink(path.join(repoRoot, "node_modules"), path.join(destination, "node_modules"), "junction");
  }

  for (const [relativePath, content] of Object.entries(templateFiles)) {
    await writeFile(path.join(fixturePackage, "template", relativePath), content);
  }
});

after(async () => {
  if (workspace) {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

for (const binary of ["create-ai-blueprint", "blueprint"]) {
  const invocation = binary === "blueprint" ? binary : "npx create-ai-blueprint@latest";

  for (const command of ["status", "dashboard", "update"]) {
    test(`${binary} ${command} help works without a template or project`, async () => {
      const { root, target } = await createTarget();
      const missingTarget = path.join(root, "missing-project");
      for (const help of ["--help", "-h"]) {
        const result = runWithoutTemplate(binary, command, help, "--target", missingTarget);

        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, "");
        assert.doesNotMatch(result.stdout, /Select AI tool adapters|Would copy:|Blueprint dashboard: http/);
        if (command === "update") {
          assert.match(result.stdout, /npx create-ai-blueprint@latest update --help|Show update help/);
          if (binary === "blueprint") {
            assert.match(result.stdout, /does not install or update Blueprint/);
            assert.doesNotMatch(result.stdout, /--force|--codex/);
          } else {
            assert.match(result.stdout, /Adapter flags add to the installed set/);
            assert.match(result.stdout, /remove adapters[\s\S]*deselect them/);
            assert.match(result.stdout, /--dry-run[\s\S]*without writing files/);
            assert.match(result.stdout, /--force backs them up/);
          }
        } else {
          assert.ok(result.stdout.includes(`${invocation} ${command} [options]`));
          assert.match(result.stdout, /--target, -t/);
          assert.doesNotMatch(result.stdout, /--codex|--force|--dry-run/);
          if (command === "status") {
            assert.match(result.stdout, /--json/);
            assert.doesNotMatch(result.stdout, /--no-open/);
          } else {
            assert.match(result.stdout, /--no-open/);
            assert.doesNotMatch(result.stdout, /--json/);
          }
        }
        await assertMissing(missingTarget);
        assert.deepEqual(await fs.readdir(target), []);
      }
    });
  }

  test(`${binary} keeps top-level help and the dashboard alias`, () => {
    const help = runWithoutTemplate(binary, "--help");
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, binary === "blueprint" ? /does not install or update/ : /Install AI Blueprint into an already scaffolded app/);
    const alias = runWithoutTemplate(binary, "ui", "--help");
    assert.equal(alias.status, 0, alias.stderr);
    assert.ok(alias.stdout.includes(`${invocation} dashboard [options]`));
  });

  test(`${binary} redirects mistaken AI skills without running or writing`, async () => {
    const { target } = await createTarget();
    for (const args of [["blueprint-doctor"], ["blueprint-doctor", "--help"], ["implement"]]) {
      const result = runWithoutTemplate(binary, ...args, "--target", target);
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /AI chat skill, not a terminal command/);
      assert.ok(result.stderr.includes(`\`$${args[0]}\` in Codex`));
      assert.ok(result.stderr.includes(`\`/${args[0]}\` in Claude Code`));
    }
    assert.deepEqual(await fs.readdir(target), []);
  });

  test(`${binary} unknown arguments point to the relevant help`, async () => {
    const { target } = await createTarget();
    for (const args of [["unknown"], ["--unknown"], ["status", "--unknown"], ["dashboard", "--unknown"], ["update", "--unknown"]]) {
      const result = runWithoutTemplate(binary, ...args, "--target", target);
      const command = args.length === 1 ? "" : ` ${args[0]}`;
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /Unknown option:/);
      assert.ok(result.stderr.includes(`\`${invocation}${command} --help\``));
    }
    assert.deepEqual(await fs.readdir(target), []);
  });

  test(`${binary} help preserves argument validation`, () => {
    for (const args of [["status", "--force"], ["dashboard", "--json"], ["update", "--all", "--codex"]]) {
      const result = runWithoutTemplate(binary, ...args, "--help");
      assert.equal(result.status, 1, result.stderr);
      assert.equal(result.stdout, "");
      assert.doesNotMatch(result.stderr, /Installer template is missing/);
    }
  });
}

test("global install and update remain unavailable and leave the target untouched", async () => {
  const { target } = await createTarget();
  for (const command of ["init", "update"]) {
    const result = runWithoutTemplate("blueprint", command, "--target", target, "--yes", "--force");
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /Use `npx create-ai-blueprint@latest` to install Blueprint/);
  }
  assert.deepEqual(await fs.readdir(target), []);
});

const linkedDestinations = [
  { relativePath: "AGENTS.md", adapter: "--codex", dangling: true, force: false },
  { relativePath: "CLAUDE.md", adapter: "--claude" },
  { relativePath: "blueprint", adapter: "--codex", directory: true, child: "config.json" },
  { relativePath: ".agents/skills/check", adapter: "--codex", directory: true, child: "SKILL.md" },
  { relativePath: ".claude/skills/check/SKILL.md", adapter: "--claude" },
  { relativePath: "blueprint/.state", adapter: "--codex", directory: true, child: "manifest.json" },
  { relativePath: "blueprint/.state/manifest.json", adapter: "--codex" },
  { relativePath: "blueprint/.state/.gitignore", adapter: "--codex", dangling: true }
];

for (const scenario of linkedDestinations) {
  test(`install refuses linked ${scenario.relativePath} before copying any files`, async () => {
    const { root, target } = await createTarget();
    const outside = path.join(root, "outside");
    const outsideFile = scenario.directory ? path.join(outside, scenario.child!) : outside;

    if (!scenario.dangling) {
      await writeFile(outsideFile, "Keep outside content\n");
    }

    const link = path.join(target, scenario.relativePath);
    await fs.mkdir(path.dirname(link), { recursive: true });
    await fs.symlink(outside, link, scenario.directory ? "dir" : "file");
    const flags = scenario.force === false ? [] : ["--force"];
    const result = runInstaller(target, scenario.adapter, ...flags);

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Refusing to install through symbolic-link path:/);
    assert.equal(result.stdout, "");
    assert.equal((await fs.lstat(link)).isSymbolicLink(), true);

    if (scenario.dangling) {
      await assertMissing(outsideFile);
    } else {
      assert.equal(await fs.readFile(outsideFile, "utf8"), "Keep outside content\n");
    }

    await assertMissing(path.join(target, "blueprint/project-plan.md"));
    if (scenario.relativePath !== "AGENTS.md") {
      await assertMissing(path.join(target, "AGENTS.md"));
    }
  });
}

for (const [relativePath, isDirectory] of [
  [".agents", false],
  ["AGENTS.md", true],
  ["blueprint/.state", false],
  ["blueprint/.state/manifest.json", true],
  ["blueprint/.state/.gitignore", true]
] as const) {
  test(`install refuses incompatible ${relativePath} before copying any files`, async () => {
    const { target } = await createTarget();
    const conflict = path.join(target, relativePath);
    const sentinel = isDirectory ? path.join(conflict, "keep.txt") : conflict;
    await writeFile(sentinel, "Keep existing content\n");

    const result = runInstaller(target, "--codex", "--force");

    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Refusing to install at .*expected a (file|directory)/);
    assert.equal(await fs.readFile(sentinel, "utf8"), "Keep existing content\n");
    await assertMissing(path.join(target, "blueprint/project-plan.md"));
    if (relativePath !== "AGENTS.md") {
      await assertMissing(path.join(target, "AGENTS.md"));
    }
  });
}

test("install refuses a linked project root without changing the external directory", async () => {
  const { root, target } = await createTarget();
  const link = path.join(root, "linked-project");
  await fs.symlink(target, link, "dir");

  const result = runInstaller(link, "--codex", "--force");

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Refusing to install through symbolic-link path:/);
  assert.deepEqual(await fs.readdir(target), []);
  assert.equal((await fs.lstat(link)).isSymbolicLink(), true);
});

test("install refuses a nonexistent target whose parent is a file", async () => {
  const { root } = await createTarget();
  const parentFile = path.join(root, "parent-file");
  await fs.writeFile(parentFile, "Keep parent content\n");

  const result = runInstaller(path.join(parentFile, "new-project"), "--codex");

  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Refusing to install at .*parent path is not a directory/);
  assert.equal(await fs.readFile(parentFile, "utf8"), "Keep parent content\n");
});

test("dry-run creates nothing and rejects unsafe destinations without replacing them", async () => {
  const { root, target } = await createTarget();
  const missingTarget = path.join(root, "missing-project");
  const safe = runInstaller(missingTarget, "--codex", "--dry-run");
  assert.equal(safe.status, 0, safe.stderr);
  assert.match(safe.stdout, /Would copy:/);
  await assertMissing(missingTarget);

  const outside = path.join(root, "missing-outside");
  await fs.symlink(outside, path.join(target, "AGENTS.md"), "file");
  const unsafe = runInstaller(target, "--codex", "--dry-run", "--force");
  assert.equal(unsafe.status, 1, unsafe.stderr);
  assert.match(unsafe.stderr, /Refusing to install through symbolic-link path:/);
  await assertMissing(outside);
  await assertMissing(path.join(target, "blueprint"));
});

test("clean and forced installs preserve untouched links and support parent directory aliases", async () => {
  const { root, target } = await createTarget();
  const alias = path.join(root, "parent-alias");
  await fs.symlink(target, alias, "dir");
  const project = path.join(alias, "nested/new-project");
  const clean = runInstaller(project, "--codex");
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(await fs.readFile(path.join(project, "AGENTS.md"), "utf8"), templateFiles["AGENTS.md"]);
  const manifestFile = path.join(project, "blueprint/.state/manifest.json");
  assert.deepEqual(JSON.parse(await fs.readFile(manifestFile, "utf8")).adapters, ["codex"]);

  const outside = path.join(root, "untouched");
  await fs.writeFile(outside, "Keep unrelated content\n");
  const untouchedLinks = ["README.md", ".agents/skills/custom.md", ".claude", "blueprint/custom.md"];
  for (const relativePath of untouchedLinks) {
    await fs.symlink(outside, path.join(project, relativePath), "file");
  }
  await fs.writeFile(path.join(project, "AGENTS.md"), "Old instructions\n");
  await fs.writeFile(path.join(project, "blueprint/.state/.gitignore"), "Old ignore rules\n");

  const forced = runInstaller(project, "--codex", "--force");
  assert.equal(forced.status, 0, forced.stderr);
  assert.equal(await fs.readFile(path.join(project, "AGENTS.md"), "utf8"), templateFiles["AGENTS.md"]);
  assert.equal(await fs.readFile(path.join(project, "blueprint/.state/.gitignore"), "utf8"), "backups/\nstaging/\nrun.json\n");
  assert.equal(await fs.readFile(outside, "utf8"), "Keep unrelated content\n");
  for (const relativePath of untouchedLinks) {
    assert.equal((await fs.lstat(path.join(project, relativePath))).isSymbolicLink(), true);
  }
});

async function createTarget(): Promise<{ root: string; target: string }> {
  const root = await fs.mkdtemp(path.join(workspace, "scenario-"));
  const target = path.join(root, "project");
  await fs.mkdir(target);
  return { root, target };
}

function runInstaller(target: string, ...flags: string[]) {
  const result = spawnSync(process.execPath, [
    tsxCli,
    path.join(fixturePackage, "bin/create-ai-blueprint.ts"),
    "--target", target, "--yes", ...flags
  ], { cwd: workspace, encoding: "utf8" });
  assert.ifError(result.error);
  return result;
}

function runWithoutTemplate(binary: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [
    tsxCli,
    path.join(fixtureWithoutTemplate, "bin", `${binary}.ts`),
    ...args
  ], { cwd: workspace, encoding: "utf8", timeout: 10_000 });
  assert.ifError(result.error);
  return result;
}

async function writeFile(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

async function assertMissing(file: string): Promise<void> {
  await assert.rejects(fs.lstat(file), { code: "ENOENT" });
}
