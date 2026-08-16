const FIX_SPEC = `# Current Feature

**Title:** Correct greeting punctuation
**Type:** Fix

## The problem

\`src/greeting.js\` prints \`Hello world\` without punctuation.

## The fix

Print \`Hello, world!\` and make no other product change.

## Build steps

- [ ] 1. Correct the greeting. Done when \`node src/greeting.js\` prints exactly
  \`Hello, world!\`.

## Verify

Run \`npm run build\`, then run \`node src/greeting.js\`.
`;

import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  const agents = t.read("AGENTS.md") ?? "";
  t.write(
    "AGENTS.md",
    agents.slice(0, agents.indexOf("## Commands")) +
      "## Commands\n\n- Build: `npm run build`\n\nTesting is not configured.\n"
  );
  t.write(
    "package.json",
    JSON.stringify(
      {
        name: "autopilot-fixture",
        private: true,
        scripts: {
          build: 'node -e "console.log(\'build ok\')"'
        }
      },
      null,
      2
    ) + "\n"
  );
  t.write("src/greeting.js", 'console.log("Hello world");\n');
  t.write("blueprint/context/current-feature.md", FIX_SPEC);
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create autopilot fixture");
  const mainBefore = t.git("rev-parse", "main");

  t.phase("autopilot builds and checks but stops before completion");
  const result = t.agent(
    "Run /autopilot resume for the current fix. Stop with the review packet. Do not run /complete, merge, or push."
  );
  const currentBranch = t.git("branch", "--show-current");
  const currentFeature = t.read("blueprint/context/current-feature.md") || "";

  t.check("agent invocation succeeded", result.status === 0);
  t.check("main was not advanced", t.git("rev-parse", "main") === mainBefore);
  t.check("work remains on a fix branch", currentBranch.startsWith("fix/"));
  t.check("the greeting was corrected",   (t.read("src/greeting.js") ?? "").includes("Hello, world!"));
  t.check("the implementation step was checked", currentFeature.includes("- [x] 1."));
  t.check(
    "main still contains the original greeting",
    t.git("show", "main:src/greeting.js").includes("Hello world")
  );
  t.check(
    "the fix branch contains at least one checkpoint commit",
    Number(t.git("rev-list", "--count", `main..${currentBranch}`)) >= 1
  );
  t.check(
    "no completion archive was added",
    t.git("status", "--porcelain", "blueprint/history").trim() === ""
  );
}

export default {
  name: "autopilot-boundary",
  description: "Autopilot may checkpoint passing work but cannot complete or merge it",
  run
};
