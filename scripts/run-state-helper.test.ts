import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const helper = path.resolve(
  ".agents",
  "skills",
  "blueprint-doctor",
  "scripts",
  "run-state.mjs"
);

test("run-state helper writes validated activity from a nested directory", async (t) => {
  const projectRoot = await createProject(t);
  const nested = path.join(projectRoot, "src", "nested");
  await fs.mkdir(nested, { recursive: true });

  await runHelper(nested, [
    "start",
    "--command", "feature",
    "--summary", "Specifying feature 3",
    "--boundary", "reviewed",
    "--feature-id", "3",
    "--feature-title", "Export reports",
    "--current", "0",
    "--total", "2",
    "--label", "build steps"
  ]);

  const started = await readState(projectRoot);
  assert.equal(started.schemaVersion, 1);
  assert.equal(started.command, "feature");
  assert.equal(started.status, "running");
  assert.deepEqual(started.feature, { id: "3", title: "Export reports" });
  assert.deepEqual(started.progress, {
    current: 0,
    total: 2,
    label: "build steps"
  });

  await runHelper(projectRoot, [
    "update",
    "--status", "blocked",
    "--summary", "A product decision is required",
    "--resume", "/feature 3"
  ]);
  const blocked = await readState(projectRoot);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.resumeCommand, "/feature 3");
  assert.equal(blocked.startedAt, started.startedAt);

  await runHelper(projectRoot, [
    "finish",
    "--status", "ready",
    "--summary", "Feature specification ready"
  ]);
  const finished = await readState(projectRoot);
  assert.equal(finished.status, "ready");
  assert.equal(finished.resumeCommand, undefined);
  assert.equal(finished.startedAt, started.startedAt);
});

test("run-state helper rejects invalid input before replacing valid state", async (t) => {
  const projectRoot = await createProject(t);
  await runHelper(projectRoot, [
    "start",
    "--command", "implement",
    "--summary", "Building the active feature",
    "--boundary", "local-only"
  ]);
  const before = await fs.readFile(runPath(projectRoot), "utf8");

  await assert.rejects(
    runHelper(projectRoot, ["update", "--current", "2"]),
    /Progress requires --current, --total, and --label together/
  );

  assert.equal(await fs.readFile(runPath(projectRoot), "utf8"), before);
});

test("run-state helper replaces malformed state on start and resets it safely", async (t) => {
  const projectRoot = await createProject(t);
  await fs.writeFile(runPath(projectRoot), "{}\n");

  await runHelper(projectRoot, [
    "start",
    "--command", "doctor",
    "--summary", "Checking Blueprint health",
    "--boundary", "read-only"
  ]);
  assert.equal((await readState(projectRoot)).command, "doctor");

  await fs.writeFile(runPath(projectRoot), "not json\n");
  await runHelper(projectRoot, ["reset"]);
  await assert.rejects(fs.access(runPath(projectRoot)), { code: "ENOENT" });
});

test("run-state helper refuses to replace or reset a symbolic link", async (t) => {
  const projectRoot = await createProject(t);
  const external = path.join(path.dirname(projectRoot), "external.json");
  await fs.writeFile(external, "outside\n");
  await fs.symlink(external, runPath(projectRoot));

  await assert.rejects(
    runHelper(projectRoot, [
      "start",
      "--command", "feature",
      "--summary", "Specifying a feature",
      "--boundary", "reviewed"
    ]),
    /Dashboard run state must be a regular file/
  );
  await assert.rejects(
    runHelper(projectRoot, ["reset"]),
    /Dashboard run state must be a regular file/
  );
  assert.equal(await fs.readFile(external, "utf8"), "outside\n");
});

async function createProject(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-run-state-"));
  const projectRoot = path.join(workspace, "project");
  await fs.mkdir(path.join(projectRoot, "blueprint", ".state"), {
    recursive: true
  });
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return projectRoot;
}

async function runHelper(cwd: string, args: string[]): Promise<void> {
  await execFileAsync(process.execPath, [helper, ...args], { cwd });
}

async function readState(projectRoot: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(runPath(projectRoot), "utf8")) as Record<
    string,
    unknown
  >;
}

function runPath(projectRoot: string): string {
  return path.join(projectRoot, "blueprint", ".state", "run.json");
}
