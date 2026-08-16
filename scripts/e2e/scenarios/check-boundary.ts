const FEATURE_SPEC = `# Current Feature

**Title:** Greeting punctuation
**Type:** Fix

## Goal

Print the punctuated greeting from the command line.

## Build steps

- [x] 1. Update the greeting output. Done when \`node src/greeting.js\` prints
  exactly \`Hello, world!\`.

## Verify

Run \`node src/greeting.js\` and compare its output with \`Hello, world!\`.
`;

import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  t.write("blueprint/context/current-feature.md", FEATURE_SPEC);
  t.write("src/greeting.js", 'console.log("Hello, world!");\n');
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create check fixture");
  t.git("checkout", "-b", "fix/greeting-punctuation");
  const headBefore = t.git("rev-parse", "HEAD");
  const sourceBefore = t.read("src/greeting.js");
  const specBefore = t.read("blueprint/context/current-feature.md");

  t.phase("check observes behavior without editing the project");
  const result = t.agent("Run /check for the current fix and report evidence for every done-when criterion.");

  t.check("agent invocation succeeded", result.status === 0);
  t.check("the greeting source stayed unchanged", t.read("src/greeting.js") === sourceBefore);
  t.check(
    "the current feature spec stayed unchanged",
    t.read("blueprint/context/current-feature.md") === specBefore
  );
  t.check("the working tree stayed clean", t.git("status", "--porcelain") === "");
  t.check("no commit was created", t.git("rev-parse", "HEAD") === headBefore);
  t.check("the report includes observed greeting output", result.resultText.includes("Hello, world!"));
  t.check("the report gives a pass or fail result", /\b(pass|fail)\b/i.test(result.resultText));
}

export default {
  name: "check-boundary",
  description: "Check proves a CLI done-when without editing source or workflow state",
  run
};
