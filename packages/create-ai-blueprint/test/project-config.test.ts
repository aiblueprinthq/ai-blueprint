import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  PROJECT_CONFIG_PATH,
  createDefaultProjectConfig,
  parseProjectConfig,
  readProjectConfig
} from "../lib/project-config.js";

test("default config reviews sensitive work automatically", () => {
  const defaults = createDefaultProjectConfig();
  const defaultGates = {
    audit: "manual",
    independentReview: "when-sensitive",
    check: "manual",
    tryGuide: "manual"
  };

  assert.deepEqual(defaults.qualityGates.regular, defaultGates);
  assert.deepEqual(defaults.qualityGates.continuous, defaultGates);
  assert.equal(defaults.workflow.stepReview, "feature");
  assert.equal(defaults.workflow.checkpointCommits, "disabled");
  assert.equal(defaults.git.landing, "local-merge");
  assert.equal(defaults.review.independentExecution, "automatic");
  assert.equal(defaults.continuous.finalIntegrationAudit, false);
});

test("manual independent review policy and execution remain valid overrides", () => {
  const config = parseProjectConfig({
    schemaVersion: 1,
    review: { independentExecution: "manual" },
    qualityGates: {
      regular: { independentReview: "manual" },
      continuous: { independentReview: "manual" }
    }
  });

  assert.equal(config.review.independentExecution, "manual");
  assert.equal(config.qualityGates.regular.independentReview, "manual");
  assert.equal(config.qualityGates.continuous.independentReview, "manual");
});

test("readProjectConfig returns defaults when config is missing", async (t) => {
  const projectRoot = await createProject(t);

  assert.deepEqual(await readProjectConfig(projectRoot), {
    path: PROJECT_CONFIG_PATH,
    state: "defaults",
    values: createDefaultProjectConfig(),
    warnings: []
  });
});

test("readProjectConfig merges partial project values over defaults", async (t) => {
  const projectRoot = await createProject(t);
  await writeConfig(projectRoot, {
    schemaVersion: 1,
    git: {
      landing: "pull-request",
      featureBranchPrefix: "feat/"
    },
    qualityGates: {
      regular: {
        audit: "when-sensitive",
        independentReview: "always",
        check: "always"
      },
      continuous: {
        tryGuide: "when-user-facing"
      }
    },
    review: {
      independentExecution: "automatic"
    },
    continuous: {
      maxFeatures: 4
    }
  });

  const result = await readProjectConfig(projectRoot);

  assert.equal(result.state, "project");
  assert.equal(result.values.git.featureBranchPrefix, "feat/");
  assert.equal(result.values.git.fixBranchPrefix, "fix/");
  assert.equal(result.values.git.landing, "pull-request");
  assert.equal(result.values.review.independentExecution, "automatic");
  assert.equal(result.values.qualityGates.regular.audit, "when-sensitive");
  assert.equal(result.values.qualityGates.regular.independentReview, "always");
  assert.equal(result.values.qualityGates.regular.check, "always");
  assert.equal(result.values.qualityGates.regular.tryGuide, "manual");
  assert.equal(
    result.values.qualityGates.continuous.tryGuide,
    "when-user-facing"
  );
  assert.equal(
    result.values.qualityGates.continuous.independentReview,
    "when-sensitive"
  );
  assert.equal(result.values.continuous.maxFeatures, 4);
  assert.equal(result.values.continuous.maxRepairAttempts, 2);
  assert.deepEqual(result.warnings, []);
});

test("readProjectConfig reports malformed JSON and falls back safely", async (t) => {
  const projectRoot = await createProject(t);
  const configPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, "not json\n");

  const result = await readProjectConfig(projectRoot);

  assert.equal(result.state, "invalid");
  assert.deepEqual(result.values, createDefaultProjectConfig());
  assert.deepEqual(result.warnings, [
    {
      code: "invalid_config",
      message: "Invalid Blueprint config JSON: blueprint/config.json"
    }
  ]);
});

test("readProjectConfig rejects unknown and invalid values", async (t) => {
  const projectRoot = await createProject(t);
  await writeConfig(projectRoot, {
    schemaVersion: 1,
    qualityGates: {
      regular: {
        audit: "sometimes"
      }
    }
  });

  const result = await readProjectConfig(projectRoot);

  assert.equal(result.state, "invalid");
  assert.match(
    result.warnings[0]?.message || "",
    /qualityGates\.regular\.audit must be one of/
  );
  assert.deepEqual(result.values, createDefaultProjectConfig());

  assert.throws(
    () => parseProjectConfig({ schemaVersion: 1, extra: true }),
    /config contains unknown key: extra/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      workflow: { manualTry: "every" }
    }),
    /workflow contains unknown key: manualTry/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      qualityGates: {
        continuous: { check: "when-sensitive" }
      }
    }),
    /qualityGates\.continuous\.check must be one of/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      qualityGates: {
        regular: { independentReview: "sometimes" }
      }
    }),
    /qualityGates\.regular\.independentReview must be one of/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      qualityGates: {
        regular: { independentReview: "off" }
      }
    }),
    /qualityGates\.regular\.independentReview must be one of/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      review: { independentExecution: "background" }
    }),
    /review\.independentExecution must be one of/
  );
  assert.throws(
    () => parseProjectConfig({
      schemaVersion: 1,
      git: { landing: "direct-push" }
    }),
    /git\.landing must be one of/
  );
});

test("readProjectConfig refuses symbolic links", async (t) => {
  const projectRoot = await createProject(t);
  const outsidePath = path.join(path.dirname(projectRoot), "outside.json");
  const configPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(outsidePath, `${JSON.stringify(createDefaultProjectConfig())}\n`);
  await fs.symlink(outsidePath, configPath);

  const result = await readProjectConfig(projectRoot);

  assert.equal(result.state, "invalid");
  assert.match(result.warnings[0]?.message || "", /symbolic link/);
});

async function createProject(t: TestContext): Promise<string> {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-config-"));
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
  return projectRoot;
}

async function writeConfig(projectRoot: string, value: unknown): Promise<void> {
  const configPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(value, null, 2)}\n`);
}
