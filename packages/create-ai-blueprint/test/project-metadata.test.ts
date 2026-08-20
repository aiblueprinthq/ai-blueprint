import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PROJECT_STATE_SCHEMA_VERSION,
  readProjectMetadata
} from "../lib/project-metadata.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/healthy-blueprint", import.meta.url)
);

test("readProjectMetadata returns versioned project identity", async () => {
  const metadata = await readProjectMetadata(fixtureRoot);

  assert.deepEqual(metadata, {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    project: {
      name: "healthy-blueprint",
      root: fixtureRoot
    },
    blueprint: {
      version: "0.7.0",
      adapters: ["codex", "claude"]
    },
    warnings: []
  });
});

test("readProjectMetadata reports an invalid manifest without hiding project identity", async (t) => {
  const workspace = await createWorkspace(t);
  const projectRoot = path.join(workspace, "app");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "blueprint", ".state", "manifest.json"),
    "not json\n"
  );

  const metadata = await readProjectMetadata(projectRoot);

  assert.equal(metadata.project.root, projectRoot);
  assert.equal(metadata.blueprint.version, null);
  assert.deepEqual(metadata.blueprint.adapters, ["codex", "claude"]);
  assert.deepEqual(metadata.warnings, [
    {
      code: "invalid_manifest",
      message: "Invalid Blueprint manifest JSON: blueprint/.state/manifest.json"
    }
  ]);
});

test("readProjectMetadata keeps Copilot distinct from Codex through the manifest", async (t) => {
  const workspace = await createWorkspace(t);
  const projectRoot = path.join(workspace, "app");

  await fs.cp(fixtureRoot, projectRoot, { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "blueprint", ".state", "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      version: "0.9.1",
      adapters: ["copilot"],
      managedFiles: {}
    }, null, 2)}\n`
  );

  const metadata = await readProjectMetadata(projectRoot);

  assert.equal(metadata.blueprint.version, "0.9.1");
  assert.deepEqual(metadata.blueprint.adapters, ["copilot"]);
});

test("readProjectMetadata rejects paths outside a Blueprint project", async (t) => {
  const workspace = await createWorkspace(t);

  await assert.rejects(
    readProjectMetadata(workspace),
    /No AI Blueprint project found from:/
  );
});

async function createWorkspace(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-metadata-"));
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));
  return workspace;
}
