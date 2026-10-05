import fs from "node:fs";
import path from "node:path";
import type { Runner } from "../harness.js";

const HEADER_PATTERN = /^### F-\d{2} \[P[0-3]\] (unverified|open|fixed|closed|accepted|invalid) - .+$/;
const CURRENT_FEATURE_STUB = `# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
> \`/feature <number-or-name>\` to spec a build-plan feature, or \`/fix "<bug>"\` for
> an ad-hoc fix. Use \`/rollback <completed-feature>\` to plan a safe reversal.
> Build one thing at a time in this checkout; \`/complete\` archives it under
> \`blueprint/history/\` and resets this file.

_Nothing in progress. Run \`/feature\`, \`/fix\`, or \`/rollback\` to start._
`;
const FINDINGS_STUB = `# Findings

> **Generated file.** The findings ledger: review findings raised by \`/audit\`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. \`/implement\` marks repaired findings \`fixed\`, a later \`/audit\` pass
> moves them to \`closed\`, and \`/complete\` refuses to land while any P0 or P1
> finding is \`open\` or \`fixed\`, then archives resolved findings with the work
> and resets this file.

_No findings recorded. \`/audit\` appends findings here when it finds them._
`;
const normalizeLineEndings = (content: string | null) => content?.replace(/\r\n/g, "\n") ?? "";
interface ArchivedFinding {
  id: string;
  status: string;
}

function parseArchiveFindings(archive: string): ArchivedFinding[] {
  const findingsHeader = /^## Findings\r?$/m.exec(archive);

  if (!findingsHeader || findingsHeader.index === undefined) {
    return [];
  }

  const afterHeader = archive.slice(findingsHeader.index + findingsHeader[0].length);
  const nextSection = afterHeader.search(/\r?\n## /);
  const findingsSection = nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);

  return [...findingsSection.matchAll(
    /^### (?:[^\s/]+\/)?(F-\d{2}) \[P[0-3]\] (unverified|open|fixed|closed|accepted|invalid) - /gm
  )].map((match) => ({ id: match[1], status: match[2] }));
}

const FIX_SPEC = `# Current Feature

**Title:** Correct greeting punctuation
**Type:** Fix

## The problem

\`src/greeting.js\` returns "Hello world" without punctuation. The greeting
should read "Hello, world!".

## The fix

Return the punctuated greeting from \`greet()\`. Nothing else changes.

## Build steps

- [x] 1. Update \`src/greeting.js\` to return the punctuated greeting. Done when
  \`node -e "console.log(require('./src/greeting').greet())"\` prints
  "Hello, world!".

## Verify

Run \`node -e "console.log(require('./src/greeting').greet())"\` and confirm it
prints "Hello, world!".
`;

const OPEN_FINDING = `# Findings

### F-01 [P1] open - greet() output is not covered by any verification

**File:** src/greeting.js:2
**Found:** 2026-07-22 by /audit (scope: current)
**Why it matters:** The fix changes user-visible output with no recorded proof
that the new string is what ships.
**Suggested fix:** Capture the command output as evidence before completing.
**Resolution:**
`;

const CLOSED_FINDING = OPEN_FINDING.replace(
  "### F-01 [P1] open -",
  "### F-01 [P1] closed -"
).replace(
  "**Resolution:**",
  "**Resolution:** Verified 2026-07-22 by /audit re-review: command output shows \"Hello, world!\" and the repair introduced no new defect."
);
const UNRESOLVED_FINDINGS = `### F-02 [P2] open - Legacy greeting helper has no focused test

**File:** src/greeting.js:2
**Found:** 2026-07-22 by /audit (scope: current)
**Why it matters:** A future refactor could change the helper without a focused
assertion documenting its expected output.
**Suggested fix:** Add a focused assertion when unit testing is configured.
**Resolution:**

### F-03 [P2] fixed - Greeting output repair needs audit re-review

**File:** src/greeting.js:2
**Found:** 2026-07-22 by /audit (scope: current)
**Why it matters:** The repair must be independently reviewed before it can close.
**Suggested fix:** Run /audit after the focused assertion is added.
**Resolution:** Repaired 2026-07-22 by /implement.

### F-04 [P3] fixed - Greeting helper naming is inconsistent

**File:** src/greeting.js:2
**Found:** 2026-07-22 by /audit (scope: current)
**Why it matters:** The name is less clear than the surrounding helpers.
**Suggested fix:** Rename it during a scoped cleanup.
**Resolution:** Renamed 2026-07-22 by /implement.

### F-05 [P3] unverified - Legacy greeting output may be unused

**File:** src/greeting.js:2
**Found:** 2026-07-22 by /audit (scope: current)
**Why it matters:** The helper may be dead code, but no source evidence confirms it.
**Suggested fix:** Re-examine the project before removing it.
**Resolution:**
`;

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();

  const agents = t.read("AGENTS.md") ?? "";
  t.write(
    "AGENTS.md",
    agents.slice(0, agents.indexOf("## Commands")) +
      "## Commands\n\n- Build: `npm run build`\n- Lint: `npm run lint`\n\nTesting is opt-in. This project declares no test command.\n"
  );
  t.write(
    "package.json",
    JSON.stringify(
      {
        name: "fixture-app",
        private: true,
        version: "0.1.0",
        scripts: {
          build: 'node -e "console.log(\'build ok\')"',
          lint: 'node -e "console.log(\'lint ok\')"'
        }
      },
      null,
      2
    ) + "\n"
  );
  t.write("src/greeting.js", 'exports.greet = () => "Hello world";\n');
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: fixture app with blueprint");
  const mainBefore = t.git("rev-parse", "main");

  t.git("checkout", "-b", "fix/greeting-punctuation");
  t.write("src/greeting.js", 'exports.greet = () => "Hello, world!";\n');
  t.write("blueprint/context/current-feature.md", FIX_SPEC);
  t.git("add", "-A");
  t.git("commit", "-m", "fix: checkpoint greeting punctuation");
  t.write("blueprint/context/findings.md", OPEN_FINDING);

  t.phase("blocked merge: /complete must refuse while F-01 [P1] is open");
  const blocked = t.agent(
    "Run /complete for the current fix. If anything blocks completion, stop and explain the blocker; do not work around it."
  );
  t.check("agent invocation succeeded", blocked.status === 0);
  t.check("main is untouched", t.git("rev-parse", "main") === mainBefore);
  t.check("fix branch still exists", t.git("branch", "--list", "fix/greeting-punctuation") !== "");
  t.check("no fix archive was written", (t.read("blueprint/history/fixes/README.md") !== null) && t.git("status", "--porcelain", "blueprint/history").trim() === "");
  t.check("spec was not reset", (t.read("blueprint/context/current-feature.md") || "").includes("Correct greeting punctuation"));
  t.check("F-01 still open in the ledger", (t.read("blueprint/context/findings.md") || "").includes("[P1] open"));
  t.check("agent names F-01 as the blocker", blocked.resultText.includes("F-01"));

  t.phase("approved merge: /complete archives F-01 and preserves unresolved findings");
  t.write("blueprint/context/findings.md", `${CLOSED_FINDING}\n${UNRESOLVED_FINDINGS}`);
  t.git("checkout", "fix/greeting-punctuation");
  const merged = t.agent(
    "Run /complete for the current fix. You have my explicit approval to squash-merge to main and delete the branch. Do not push anywhere."
  );
  t.check("agent invocation succeeded", merged.status === 0);
  const mainAfter = t.git("rev-parse", "main");
  t.check("main advanced by the merge", mainAfter !== mainBefore);
  t.check("merge commit is a conventional fix commit", t.git("log", "-1", "--format=%s", "main").startsWith("fix:"));
  t.check("fix branch was deleted", t.git("branch", "--list", "fix/greeting-punctuation") === "");

  const archiveList = t.git("ls-tree", "-r", "--name-only", "main", "blueprint/history/fixes");
  const archiveFile = archiveList.split("\n").find((file) => file.endsWith(".md") && !file.endsWith("README.md"));
  const archive = archiveFile ? t.git("show", `main:${archiveFile}`) : "";
  const archiveFindings = parseArchiveFindings(archive);
  t.check("fix archive exists", Boolean(archiveFile));
  t.check(
    "archive carries F-01 at closed",
    archiveFindings.some((finding) => finding.id === "F-01" && finding.status === "closed")
  );
  t.check(
    "archive excludes unresolved fixed P2/P3 findings",
    !archiveFindings.some((finding) => finding.id === "F-03" || finding.id === "F-04")
  );
  t.check(
    "archive excludes unresolved open and unverified findings",
    !archiveFindings.some((finding) => finding.id === "F-02" || finding.id === "F-05")
  );
  t.check(
    "spec reset to the canonical stub",
    normalizeLineEndings(t.read("blueprint/context/current-feature.md")) === CURRENT_FEATURE_STUB
  );
  t.check(
    "unresolved open P2 finding remains unchanged in the ledger",
    normalizeLineEndings(t.read("blueprint/context/findings.md")).includes(
      UNRESOLVED_FINDINGS.slice(0, UNRESOLVED_FINDINGS.indexOf("\n\n### F-03"))
    )
  );
  t.check(
    "unresolved fixed P2 finding remains unchanged in the ledger",
    normalizeLineEndings(t.read("blueprint/context/findings.md")).includes(
      UNRESOLVED_FINDINGS.slice(
        UNRESOLVED_FINDINGS.indexOf("### F-03"),
        UNRESOLVED_FINDINGS.indexOf("\n\n### F-04")
      )
    )
  );
  t.check(
    "unresolved fixed P3 finding remains unchanged in the ledger",
    normalizeLineEndings(t.read("blueprint/context/findings.md")).includes(
      UNRESOLVED_FINDINGS.slice(
        UNRESOLVED_FINDINGS.indexOf("### F-04"),
        UNRESOLVED_FINDINGS.indexOf("\n\n### F-05")
      )
    )
  );
  t.check(
    "unresolved unverified finding remains unchanged in the ledger",
    normalizeLineEndings(t.read("blueprint/context/findings.md")).includes(
      UNRESOLVED_FINDINGS.slice(UNRESOLVED_FINDINGS.indexOf("### F-05"))
    )
  );
  t.check(
    "ledger does not retain archived F-01 or reset to the empty stub",
    !normalizeLineEndings(t.read("blueprint/context/findings.md")).includes("### F-01") &&
      normalizeLineEndings(t.read("blueprint/context/findings.md")) !== FINDINGS_STUB
  );

  t.phase("lazy-create: /audit rebuilds a deleted ledger in valid format");
  t.git("checkout", "main");
  fs.rmSync(path.join(t.workspace, "blueprint", "context", "findings.md"));
  t.write(
    "src/util.js",
    'exports.formatGreeting = () => "Hello, world!";\nexports.unusedLegacyGreeting = () => "Hello world";\n'
  );
  const audited = t.agent("Run /audit changed.");
  t.check("agent invocation succeeded", audited.status === 0);
  const ledger = t.read("blueprint/context/findings.md");
  t.check("ledger was lazy-created", ledger !== null && ledger.includes("# Findings"));
  const headers = (ledger || "")
    .split(/\r?\n/)
    .filter((line) => line.startsWith("### "));
  t.check(
    `all ${headers.length} entry headers match the contract`,
    headers.every((line) => HEADER_PATTERN.test(line))
  );
  t.check(
    "audit did not edit source files",
    (t.read("src/util.js") ?? "").includes("unusedLegacyGreeting") && t.git("status", "--porcelain", "src/greeting.js") === ""
  );
}

export default {
  name: "ledger-gate",
  description: "The findings ledger blocks, releases, and lazy-creates correctly",
  run
};
