import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { parseRunState, readRunState } from "../lib/run-state.js";

test("parseRunState returns a recorded Continuous run", () => {
  const run = parseRunState(JSON.stringify({
    schemaVersion: 1,
    command: "continuous",
    status: "running",
    summary: "Completing the remaining build plan",
    detail: "Implementing the current feature.",
    boundary: "local-only",
    startedAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:05:00.000Z",
    resumeCommand: "/continuous resume",
    progress: { current: 2, total: 5, label: "features" },
    feature: { id: "19", title: "Campaign deletion" }
  }), new Date("2026-08-26T12:10:00.000Z"));

  assert.equal(run.state, "recorded");
  assert.equal(run.mode, "continuous");
  assert.equal(run.command, "continuous");
  assert.equal(run.status, "running");
  assert.equal(run.freshness, "current");
  assert.deepEqual(run.progress, { current: 2, total: 5, label: "features" });
  assert.deepEqual(run.feature, { id: "19", title: "Campaign deletion" });
  assert.deepEqual(run.warnings, []);
});

test("parseRunState marks interrupted running activity as stale", () => {
  const run = parseRunState(JSON.stringify({
    schemaVersion: 1,
    command: "continuous",
    status: "running",
    summary: "Completing the remaining build plan",
    startedAt: "2026-08-26T10:00:00.000Z",
    updatedAt: "2026-08-26T10:30:00.000Z",
    resumeCommand: "/continuous resume"
  }), new Date("2026-08-26T12:00:01.000Z"));

  assert.equal(run.freshness, "stale");
  assert.equal(run.state, "recorded");
  assert.equal(run.status, "running");
  assert.equal(run.resumeCommand, "/continuous resume");
  assert.deepEqual(run.warnings, []);
});

test("parseRunState treats other commands as manual mode", () => {
  const run = parseRunState(JSON.stringify({
    schemaVersion: 1,
    command: "audit",
    status: "completed",
    summary: "Audited the active feature",
    boundary: "read-only",
    startedAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:03:00.000Z"
  }));

  assert.equal(run.mode, "manual");
  assert.equal(run.command, "audit");
  assert.equal(run.status, "completed");
});

test("parseRunState rejects malformed or incomplete state", () => {
  const invalidJson = parseRunState("not-json");
  const invalidSchema = parseRunState("{}");

  assert.equal(invalidJson.state, "malformed");
  assert.match(invalidJson.warnings[0]?.message || "", /Run \/blueprint-doctor/);
  assert.equal(invalidSchema.state, "malformed");
  assert.match(invalidSchema.warnings[0]?.message || "", /Run \/blueprint-doctor/);
  assert.equal(
    parseRunState(JSON.stringify({
      schemaVersion: 1,
      command: "continuous",
      status: "running",
      summary: "Running",
      startedAt: "not-a-date",
      updatedAt: "2026-08-26T12:03:00.000Z"
    })).state,
    "malformed"
  );
});

test("readRunState keeps unsafe and invalid-path warnings", async (t) => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-run-state-"));
  const stateRoot = path.join(projectRoot, "blueprint", ".state");
  const outsideFile = path.join(projectRoot, "outside.json");
  const runStatePath = path.join(stateRoot, "run.json");
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));

  await fs.mkdir(stateRoot, { recursive: true });
  await fs.writeFile(outsideFile, "{}\n");
  await fs.symlink(outsideFile, runStatePath);

  const unsafe = await readRunState(projectRoot);
  assert.equal(unsafe.state, "malformed");
  assert.equal(unsafe.warnings[0]?.code, "unsafe_run_state_path");

  await fs.rm(runStatePath);
  await fs.mkdir(runStatePath);

  const invalid = await readRunState(projectRoot);
  assert.equal(invalid.state, "malformed");
  assert.equal(invalid.warnings[0]?.code, "invalid_run_state_path");
});
