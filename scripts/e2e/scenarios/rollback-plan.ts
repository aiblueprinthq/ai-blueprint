const FEATURE_ARCHIVE = `# Feature 1: Greeting punctuation

**Type:** Feature
**Status:** Complete

## Goal

Change the default output from \`Hello world\` to \`Hello, world!\`.

## Build steps

- [x] 1. Update \`src/greeting.js\`.

## Verification

\`node src/greeting.js\` printed \`Hello, world!\`.
`;

import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  t.write("blueprint/build-plan.md", "# Build Plan\n\n- [ ] 1. Greeting punctuation\n");
  t.write("src/greeting.js", 'console.log("Hello world");\n');
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create rollback baseline");

  t.write("blueprint/build-plan.md", "# Build Plan\n\n- [x] 1. Greeting punctuation\n");
  t.write("blueprint/history/features/01-greeting-punctuation.md", FEATURE_ARCHIVE);
  t.write("src/greeting.js", 'console.log("Hello, world!");\n');
  t.git("add", "-A");
  t.git("commit", "-m", "feat: add greeting punctuation");
  const featureCommit = t.git("rev-parse", "HEAD");
  const featureParent = t.git("rev-parse", `${featureCommit}^`);

  t.write("src/unrelated.js", 'module.exports = "later work";\n');
  t.git("add", "-A");
  t.git("commit", "-m", "feat: add unrelated utility");
  const headBefore = t.git("rev-parse", "HEAD");
  const archiveBefore = t.read("blueprint/history/features/01-greeting-punctuation.md");

  t.phase("rollback plans the reversal without applying it");
  const result = t.agent(
    "Run /rollback 1 because the punctuation breaks a strict downstream consumer. Plan it and stop for review."
  );
  const rollbackSpec = t.read("blueprint/context/current-feature.md") || "";
  const changedPaths = t
    .git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(/^[ MADRCU?!]{1,2}\s+/, ""));

  t.check("agent invocation succeeded", result.status === 0);
  t.check("the repository stayed on main", t.git("branch", "--show-current") === "main");
  t.check("no commit was created", t.git("rev-parse", "HEAD") === headBefore);
  t.check("product code was not reversed", (t.read("src/greeting.js") ?? "").includes("Hello, world!"));
  t.check(
    "the completed feature archive was preserved",
    t.read("blueprint/history/features/01-greeting-punctuation.md") === archiveBefore
  );
  t.check("a rollback spec was written", /^\*\*Type:\*\*\s*Rollback\s*$/im.test(rollbackSpec));
  t.check("the spec records the exact feature commit", rollbackSpec.includes(featureCommit));
  t.check("the spec records the exact feature parent", rollbackSpec.includes(featureParent));
  t.check("the spec records the user's reason", /downstream consumer/i.test(rollbackSpec));
  t.check(
    "only the current feature spec changed",
    changedPaths.length === 1 && changedPaths[0] === "blueprint/context/current-feature.md"
  );
}

export default {
  name: "rollback-plan",
  description: "Rollback preserves history and product code while preparing a guarded spec",
  run
};
