const PROJECT_PLAN = `# Project Plan

## Product

A tiny command-line greeting app used to exercise the Blueprint workflow.

## Users

Developers who need a predictable greeting.

## Stack

Node.js with CommonJS modules and no dependencies.
`;

const BUILD_PLAN = `# Build Plan

- [ ] 1. Personalized greeting - accept a name and include it in the output
`;

const PROJECT_OVERVIEW = `# Project Overview

## Product

A dependency-free Node.js command-line greeting app.

## Current behavior

Running \`node src/greeting.js\` prints \`Hello, world!\`.

## Planned work

Feature 1 adds an optional name while preserving the default greeting.

## Constraints

- Keep the public command backward compatible.
- Do not add dependencies.
`;

import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  t.write("blueprint/project-plan.md", PROJECT_PLAN);
  t.write("blueprint/build-plan.md", BUILD_PLAN);
  t.write("blueprint/context/project-overview.md", PROJECT_OVERVIEW);
  t.write("src/greeting.js", 'console.log("Hello, world!");\n');
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create feature planning fixture");
  const headBefore = t.git("rev-parse", "HEAD");
  const sourceBefore = t.read("src/greeting.js");

  t.phase("feature writes a spec and stops before implementation");
  const result = t.agent(
    "Run /feature 1. Write and red-team the spec, then stop at its review gate. Do not implement it."
  );
  const currentFeature = t.read("blueprint/context/current-feature.md") || "";
  const changedPaths = t
    .git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^[ MADRCU?!]{1,2}\s+/, ""));

  t.check("agent invocation succeeded", result.status === 0);
  t.check("a personalized greeting spec was written", /personalized greeting/i.test(currentFeature));
  t.check("the spec has unchecked build steps", currentFeature.includes("- [ ]"));
  t.check("the spec defines observable done-when criteria", /done when/i.test(currentFeature));
  t.check("product source was not edited", t.read("src/greeting.js") === sourceBefore);
  t.check("no implementation branch was created", t.git("branch", "--show-current") === "main");
  t.check("no commit was created", t.git("rev-parse", "HEAD") === headBefore);
  t.check(
    "only the current feature spec changed",
    changedPaths.length === 1 && changedPaths[0] === "blueprint/context/current-feature.md"
  );
}

export default {
  name: "feature-gate",
  description: "Feature planning writes a reviewed spec without starting implementation",
  run
};
