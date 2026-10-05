import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultProjectConfig,
  parseProjectConfig
} from "../packages/create-ai-blueprint/lib/project-config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const codexSkillsRoot = path.join(repoRoot, ".agents", "skills");
const claudeSkillsRoot = path.join(repoRoot, ".claude", "skills");
const currentFeatureStub = `# Current Feature

> **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
> \`/feature <number-or-name>\` to spec a build-plan feature, or \`/fix "<bug>"\` for
> an ad-hoc fix. Use \`/rollback <completed-feature>\` to plan a safe reversal.
> Build one thing at a time in this checkout; \`/complete\` archives it under
> \`blueprint/history/\` and resets this file.

_Nothing in progress. Run \`/feature\`, \`/fix\`, or \`/rollback\` to start._
`;
const findingsStub = `# Findings

> **Generated file.** The findings ledger: review findings raised by \`/audit\`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. \`/implement\` marks repaired findings \`fixed\`, a later \`/audit\` pass
> moves them to \`closed\`, and \`/complete\` refuses to land while any P0 or P1
> finding is \`open\` or \`fixed\`, then archives resolved findings with the work
> and resets this file.

_No findings recorded. \`/audit\` appends findings here when it finds them._
`;
const reviewStub = `# Independent Review

> **Generated file.** Holds the active independent-review request or latest
> receipt for the current work item. \`/audit independent current\` prepares a
> handoff against an approved checkpoint, a fresh reviewer context completes it,
> and \`/complete\` refuses stale, pending, or changes-requested review state.

_No independent review requested. Run \`/audit independent current\` to prepare one._
`;
const requiredPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/release.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/validate.yml",
  "assets/mark-dark.svg",
  "assets/mark-light.svg",
  "assets/social-preview.png",
  "assets/social-preview.svg",
  "blueprint/build-plan.md",
  "blueprint/config.json",
  "blueprint/project-plan.md",
  "blueprint/context/ai-interaction.md",
  "blueprint/context/coding-standards.md",
  "blueprint/context/current-feature.md",
  "blueprint/context/findings.md",
  "blueprint/context/review.md",
  "blueprint/context/project-overview.md",
  "blueprint/history/features/README.md",
  "blueprint/history/fixes/README.md",
  "blueprint/history/rollbacks/README.md",
  "packages/create-ai-blueprint/bin/create-ai-blueprint.ts",
  "packages/create-ai-blueprint/LICENSE",
  "packages/create-ai-blueprint/lib/update.ts",
  "packages/create-ai-blueprint/package.json"
];

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function parseRecord(content: string, source: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(content);

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${source} must contain a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

async function main(): Promise<void> {
  await validateRequiredPaths();
  await validateProjectConfig();

  const codexFiles = await listFiles(codexSkillsRoot);
  const claudeFiles = await listFiles(claudeSkillsRoot);
  assertEqualLists(codexFiles, claudeFiles, "adapter file inventory");

  for (const relativePath of codexFiles) {
    const codexFile = path.join(codexSkillsRoot, ...relativePath.split("/"));
    const claudeFile = path.join(claudeSkillsRoot, ...relativePath.split("/"));
    const [codexContent, claudeContent] = await Promise.all([
      fs.readFile(codexFile, "utf8"),
      fs.readFile(claudeFile, "utf8")
    ]);

    const comparableClaudeContent = relativePath.endsWith("SKILL.md")
      ? claudeContent.replace("disable-model-invocation: true\n", "")
      : claudeContent;

    if (relativePath.endsWith("SKILL.md") && !claudeContent.includes("disable-model-invocation: true")) {
      throw new Error(`Claude skill is not explicit-only: ${relativePath}`);
    }

    if (codexContent !== comparableClaudeContent) {
      throw new Error(`Adapter files differ: ${relativePath}`);
    }
  }

  const skills = await getSkillNames(codexSkillsRoot);
  await validateSkillMetadata(skills);
  await validateCommandInventories(skills);
  await validateDashboardActivityContract(skills);
  await validateVerificationContract();
  await validateCanonicalStubs();
  await validateRepositoryPolish();
  const importCount = await validateClaudeImports();
  const referenceCount = await validateSkillReferences(codexFiles);
  await validatePackageMetadata();

  console.log(
    `Static contract passed: ${skills.length} skills, ${codexFiles.length} adapter files, ${importCount} Claude imports, ${referenceCount} skill references.`
  );
}

async function validateProjectConfig(): Promise<void> {
  const configPath = path.join(repoRoot, "blueprint", "config.json");
  const config = parseProjectConfig(
    JSON.parse(await fs.readFile(configPath, "utf8"))
  );

  if (JSON.stringify(config) !== JSON.stringify(createDefaultProjectConfig())) {
    throw new Error("blueprint/config.json must contain the complete default config");
  }
}

async function validateRequiredPaths(): Promise<void> {
  for (const relativePath of requiredPaths) {
    await requirePath(path.join(repoRoot, ...relativePath.split("/")), relativePath);
  }
}

async function listFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(current: string, relative: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
      const stats = await fs.lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in adapter skills: ${relativePath}`);
      }

      if (stats.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (stats.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`Unsupported adapter entry: ${relativePath}`);
      }
    }
  }

  await visit(root, "");
  return files.sort();
}

async function getSkillNames(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const skills: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`Unexpected entry in skills directory: ${entry.name}`);
    }

    await requirePath(path.join(root, entry.name, "SKILL.md"), `${entry.name}/SKILL.md`);
    skills.push(entry.name);
  }

  return skills.sort();
}

async function validateSkillMetadata(skills: readonly string[]): Promise<void> {
  let totalDescriptionCharacters = 0;

  for (const skill of skills) {
    const skillFile = path.join(codexSkillsRoot, skill, "SKILL.md");
    const content = await fs.readFile(skillFile, "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!frontmatter) {
      throw new Error(`Missing frontmatter: .agents/skills/${skill}/SKILL.md`);
    }

    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

    if (name !== skill) {
      throw new Error(`Skill name does not match its directory: ${skill}`);
    }

    if (name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      throw new Error(`Skill name is not portable to OpenCode: ${skill}`);
    }

    if (!description) {
      throw new Error(`Skill description is missing: ${skill}`);
    }

    if (description.length > 400) {
      throw new Error(`Skill description exceeds the context budget: ${skill}`);
    }

    if (!content.includes("**Context reuse:** Reuse any required file already loaded")) {
      throw new Error(`Skill does not enforce loaded context reuse: ${skill}`);
    }

    totalDescriptionCharacters += description.length;
  }

  if (totalDescriptionCharacters > 7500) {
    throw new Error(
      `Skill descriptions exceed the 7,500-character context budget: ${totalDescriptionCharacters}`
    );
  }
}

async function validateCommandInventories(skills: readonly string[]): Promise<void> {
  const [agents, readme] = await Promise.all([
    fs.readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "README.md"), "utf8")
  ]);
  const coreBlock = agents.match(/Core skills:\r?\n([\s\S]*?)\r?\nIn Codex/);

  if (!coreBlock) {
    throw new Error("Could not find the Core skills inventory in AGENTS.md");
  }

  const agentSkills = [...coreBlock[1].matchAll(/^- `([a-z0-9-]+)`/gm)].map(
    (match) => match[1]
  );
  const optionalSkills = [
    ...agents.matchAll(/Optional explicit-only skill: `([a-z0-9-]+)`/g)
  ].map((match) => match[1]);
  const readmeSkills = [
    ...readme.matchAll(/^\| \*\*\/([a-z0-9-]+)\*\* \|/gm)
  ].map((match) => match[1]);

  assertEqualLists(skills, [...agentSkills, ...optionalSkills].sort(), "AGENTS.md commands");
  assertEqualLists(skills, readmeSkills.sort(), "README command table");
}

async function validateDashboardActivityContract(skills: readonly string[]): Promise<void> {
  const agents = await fs.readFile(path.join(repoRoot, "AGENTS.md"), "utf8");
  const trackedBlock = agents.match(
    /Commands with meaningful progress or a durable handoff should write it when the\s+state directory exists:([\s\S]*?)\. Short/
  );

  if (!trackedBlock) {
    throw new Error("Could not find the dashboard activity command inventory in AGENTS.md");
  }

  for (const required of [
    "Never create or edit `run.json` directly.",
    ".agents/skills/doctor/scripts/run-state.mjs",
    ".claude/skills/doctor/scripts/run-state.mjs"
  ]) {
    if (!agents.includes(required)) {
      throw new Error(`Dashboard activity contract is missing: ${required}`);
    }
  }

  for (const relativePath of [
    ".agents/skills/doctor/scripts/run-state.mjs",
    ".claude/skills/doctor/scripts/run-state.mjs"
  ]) {
    await requirePath(
      path.join(repoRoot, ...relativePath.split("/")),
      relativePath
    );
  }

  const trackedSkills = [...trackedBlock[1].matchAll(/`([a-z0-9-]+)`/g)].map(
    (match) => match[1]
  );
  const knownSkills = new Set(skills);
  const directive = "**First action:** Before project inspection, preflight, or any other tool call,";

  for (const skill of trackedSkills) {
    if (!knownSkills.has(skill)) {
      throw new Error(`Dashboard activity references an unknown skill: ${skill}`);
    }

    const content = await fs.readFile(path.join(codexSkillsRoot, skill, "SKILL.md"), "utf8");
    if (!content.includes(directive)) {
      throw new Error(`Tracked skill does not publish immediate dashboard activity: ${skill}`);
    }
  }
}

async function validateVerificationContract(): Promise<void> {
  const requirements = new Map([
    [
      ".agents/skills/explore/SKILL.md",
      [
        "No plans or active feature are required.",
        "This command never writes activity state",
        "Include doing nothing",
        "Never install dependencies, execute product code, run tests or builds",
        "Never create or switch branches",
        "Do not invoke another command automatically.",
        "There is no mandatory output template"
      ]
    ],
    [
      ".agents/skills/onboard/SKILL.md",
      [
        "Run /ci or $ci when you want automatic GitHub checks.",
        "`/discovery` is optional and never runs as part of onboarding",
        "Efficient (Recommended)",
        "Guided",
        "Custom",
        "Never write an `implementationStyle` key",
        "A later `/implement` run reads the current configuration",
        "git rev-parse --verify HEAD",
        "Both are valid",
        "handle it here instead of sending the user away",
        "Create the initial scaffold commit and continue Onboard? (Recommended)",
        "authoritative installer selection",
        "does not mean all four tools were selected",
        "Do not ask the user to select adapters again",
        "point to `/doctor` instead of guessing"
      ]
    ],
    [
      ".agents/skills/discovery/SKILL.md",
      [
        "This skill is always optional",
        "Never start it automatically from `/onboard`",
        "Do not write either file in the same response that first presents them",
        "stop before generating `blueprint/context/project-overview.md`",
        "Follow the proportional-engineering contract in `AGENTS.md`"
      ]
    ],
    [
      ".agents/skills/overview/SKILL.md",
      [
        "Discovery is not a gate",
        "Never require `/discovery`",
        "syntax-only formatting without an extra approval pause",
        "stays byte-for-byte unchanged",
        "Preserve wording, order, feature count, notes, headings, nesting, existing IDs",
        "and completion markers, including `[X]`",
        "never renumber existing items or reuse an",
        "including duplicate IDs or ambiguous feature boundaries",
        "This is reviewed reconciliation, not automatic formatting",
        "Save the formatted checklist or approved reconciliation in `build-plan.md`",
        "Read the final saved plan bytes after any formatting or approved reconciliation",
        "Formatting authority does not change Git or other approval gates",
        "Never create this commit silently",
        "Finalize the Blueprint baseline locally? (Recommended)",
        "chore: establish Blueprint project baseline",
        "dedicated setup branch",
        "blueprint/.state/manifest.json",
        "git merge --ff-only",
        "It never pushes",
        "Do not offer this baseline on later overview reruns once `HEAD` already contains",
        "overview must remain below 20,000 bytes",
        "normalize only build-plan completion markers",
        "without treating completed features as overview drift",
        "Omit it when the usage-model section",
        "absent, unanswered, or contains only worksheet prompts",
        "Never create additional generated context files"
      ]
    ],
    [
      ".agents/skills/adopt/SKILL.md",
      [
        "Run /ci or $ci when you want automatic GitHub checks.",
        "Follow and preserve the proportional-engineering contract in `AGENTS.md`"
      ]
    ],
    [
      ".agents/skills/ci/SKILL.md",
      [
        ".github/workflows/verify.yml",
        "permissions: contents: read",
        "Never push or change a remote ruleset",
        "prepared locally, not CI verified",
        "authoritative clean-checkout proof"
      ]
    ],
    [
      ".agents/skills/check/SKILL.md",
      [
        "Select the mode before any tool call",
        "reference/guide.md",
        "reference/verify.md",
        "Load only the selected reference",
        "Guide generation never satisfies a verification gate",
        "`qualityGates.regular.tryGuide` and `qualityGates.continuous.tryGuide`"
      ]
    ],
    [
      ".agents/skills/check/reference/guide.md",
      [
        "Do not edit files, write activity state, update spec",
        "run checks or the app",
        "A guide\nnever counts as acceptance evidence",
        "For `latest`, use the most recent archive even when an active spec exists",
        "explicitly route to `/check`"
      ]
    ],
    [
      ".agents/skills/check/reference/verify.md",
      [
        "Verification activity was started by the dispatcher",
        "verification failed",
        "verification incomplete",
        "Every `pass` is backed by something observed"
      ]
    ],
    [
      ".agents/skills/tests/SKILL.md",
      [
        "reference/unit.md",
        "reference/browser.md",
        "Load only the selected reference",
        "A runner name alone never selects browser setup",
        "`tests` as the command"
      ]
    ],
    [
      ".agents/skills/tests/reference/unit.md",
      ["add the real test command", "never creates a GitHub workflow on its own"]
    ],
    [
      ".agents/skills/status/SKILL.md",
      [
        "markers normalized to `- [ ]`",
        "matching legacy exact-byte hash",
        "Do not use filesystem timestamps",
        "independent review defaults to `when-sensitive`",
        "execution defaults to `automatic`"
      ]
    ],
    [
      ".agents/skills/tests/reference/browser.md",
      [
        "Browser tests: <command>",
        "Do not add browser tests to the default Verify command",
        "Continuous needs no separate browser mode",
        "does not replace live browser inspection"
      ]
    ],
    [
      ".agents/skills/implement/SKILL.md",
      [
        "Add an abstraction, dependency, service, configuration surface, compatibility",
        "only when the approved spec or an established repository requirement needs it now",
        "Run a proportionality check before final verification",
        "declares a `Verify` command, run that exact",
        "fallback build and tests",
        "verification.logicTests: required",
        "verification.uiEvidence:",
        "Use the exact `**Branch:**` value",
        "Walk me through the implementation.",
        "available with either `workflow.stepReview` value",
        "read-only code tour",
        "review.independentExecution",
        "After final Verify and required Check pass, set the active spec to `verified`",
        "Continue to the final packet only with a current passing receipt",
        "never grants commit permission",
        "local `Spec snapshot` contract without changing visibility",
        "Do not create an empty commit for ignored spec changes",
        "sole exception is exactly one immutable independent-review checkpoint",
        "receiving current explicit commit approval",
        "Treat an existing request without `Requested execution` as legacy manual-only"
      ]
    ],
    [
      ".agents/skills/implement/reference/rollback-implementation.md",
      [
        "both values match `^[0-9a-f]{40}$`",
        "verify it has exactly one parent",
        "Stop on a merge target",
        "resolved parent exactly equals `Target parent`",
        "Use only the resolved full SHA values"
      ]
    ],
    [
      ".agents/skills/feature/SKILL.md",
      [
        "Apply proportional engineering before drafting",
        "usage-model, data-model, stack, UI, security, or deployment",
        "Unknown scale or future extensibility defaults to the smaller reversible design",
        "Treat a trust or data-integrity boundary as established",
        "Untuned stack-specific standards in `coding-standards.md` are not established requirements",
        "repository-first tenant scope",
        "Build one authoritative feature packet",
        "Do not read the whole overview by default",
        "Do not invent presets, defaults, limits, permissions",
        "Write the final spec once",
        "# Feature: <title>",
        "**From build-plan:** feature <id>",
        "**Build attempt:** <positive integer>",
        "reference/build-history.md",
        "feature/export-reports--build-2",
        "Record `**Branch:**` with the",
        "Do not bury repair inside this feature",
        "Never implement from this skill"
      ]
    ],
    [
      ".agents/skills/feature/reference/build-history.md",
      [
        "max(attempts) + 1",
        "unique introducing commit",
        "**Target archive:**",
        "**Target commit:**",
        "Ignored local-only history",
        "git log --all --reflog --full-history",
        "including a dangling symlink"
      ]
    ],
    [
      ".agents/skills/fix/SKILL.md",
      [
        "Adding a missing authorization, ownership, validation, escaping, or redaction check",
        "first heading must be exactly",
        "`# Fix: <title>`",
        "`**Type:** Fix` contract"
      ]
    ],
    [
      ".agents/skills/audit/SKILL.md",
      [
        "For a proportionality finding, state in **Suggested fix** what can be deleted",
        "Untuned stack-specific template defaults are not established requirements",
        "Use `None` when no current requirement would be lost",
        "An otherwise pure proportionality finding is P2 or P3",
        "require an explicit user decision and never describe it as an automatic repair",
        "`/audit independent current` is a two-context workflow",
        "Never let a builder complete its own independent request",
        "A stale receipt is no receipt",
        "Record `fresh subagent` as its reviewer context",
        "may write only `blueprint/context/findings.md` and `blueprint/context/review.md`",
        "Spawn a generic fresh isolated child through the current runtime",
        "Do not discover, select, or depend on a globally installed role, skill, prompt",
        "read the project-local Audit skill",
        "pending request without `Requested execution` is legacy and manual only",
        "omit `Actual execution`",
        "create or reuse the exact snapshot first",
        "Phase B may write only",
        "same ignored spec/snapshot inputs",
        "working tree matching the target except existing `blueprint/context/review.md` and `blueprint/context/findings.md` evidence",
        "tracked, staged, unstaged, or untracked path other than those two evidence paths differs from the target, stop",
        "Do not create a checkpoint solely for review/findings changes",
        "normal Phase A exception never allows snapshot Git differences",
        "gate value disables only\nautomatic selection by the workflow"
      ]
    ],
    [
      ".agents/skills/audit/reference/independent-review.md",
      [
        "**Target commit:** <full 40-character checkpoint SHA>",
        "**Base ref:** <local branch or remote-tracking ref used for the merge base>",
        "**Reviewer context:** <fresh session or fresh subagent>",
        "**Requested execution:** <manual or automatic>",
        "**Actual execution:** <manual or automatic>",
        "a fresh reviewer context completes it",
        "**Check result:** <passed, failed, unavailable, or not-required>",
        "cannot cryptographically prove",
        "generic current-runtime child",
        "never depends on a global role",
        "Legacy receipts with neither execution field",
        "pending request without `Requested execution` is a legacy manual request",
        "Never auto-upgrade it or send it to a subagent",
        "**Spec snapshot:** blueprint/.state/review-specs/<Target commit>-<Spec hash>.md",
        "plain path with no backticks",
        "Never retroactively add `Spec snapshot`",
        "raw bytes",
        "ignored and untracked, absent from the index and `Target commit`",
        "Create the snapshot exclusively",
        "never overwrite or repair the existing snapshot in place",
        "Git failure never passes",
        "A local-spec-only revision may reuse the same approved product HEAD",
        "Never create an empty commit"
      ]
    ],
    [
      ".agents/skills/complete/SKILL.md",
      [
        "exact `Verify` command from `AGENTS.md`",
        "fallback build and tests",
        "Keep every unresolved entry in the ledger",
        "A `fixed` entry is not resolved at any severity",
        "must remain verbatim for a later `/audit` re-review",
        "checkbox-normalized hash contract",
        "migrates older exact-byte fingerprints",
        "replace `blueprint/context/current-feature.md` with the canonical stub below",
        "Never merge with a required or explicitly initiated independent review",
        "### Independent review execution",
        "Obtain explicit commit approval",
        "For requested `automatic`",
        "Continue Complete only with a current passing receipt",
        "pending request without `Requested execution` is legacy",
        "local `Spec snapshot` contract without changing visibility",
        "the original `Spec snapshot` field when present",
        "Before requiring a real active spec",
        "reference/completion-recovery.md",
        "git.landing",
        "With `git.landing: \"pull-request\"`",
        "Never merge the pull request",
        "NN-name--build-N.md",
        "12-build-2/F-03"
      ]
    ],
    [
      ".agents/skills/complete/reference/completion-recovery.md",
      [
        '"specBytes"',
        '"sourceTree"',
        '"landing"',
        '"absentOptional"',
        "## Screen candidates read-only",
        "historical-build exclusion",
        "never allocate a new attempt on resume",
        "## Interrupted archival, before the work commit",
        "## Work committed, awaiting landing",
        "## Pull request opened or merged",
        "## Merge already completed",
        "Never relabel the receipt as current",
        "hash-proven original archive prefix",
        "Do not create a new snapshot or relabel the target",
        "does not replace source-tree/product proof or recover other ignored evidence",
        "Do not force-add ignored workflow files"
      ]
    ],
    [
      ".agents/skills/status/SKILL.md",
      ["Pending completion candidate", "../complete/reference/completion-recovery.md"]
    ],
    [
      ".agents/skills/rollback/SKILL.md",
      [
        "target commit and parent commit as full 40-character SHA values",
        "`# Rollback: Feature <id> - <title>`",
        "`**Type:** Rollback` contract",
        "stop before Step 2 and before",
        "writing or changing `blueprint/context/current-feature.md`",
        "Publish `blocked` to",
        "Do not record a target parent or choose a mainline",
        "retains its merge-target stop as defense in depth",
        "exactly one unreversed build",
        "../feature/reference/build-history.md"
      ]
    ],
    [
      ".agents/skills/rollback/reference/rollback-spec-template.md",
      [
        "**Target commit:** `<full 40-character commit SHA>`",
        "**Target parent:** `<full 40-character parent SHA>`"
      ]
    ],
    [
      ".agents/skills/doctor/SKILL.md",
      [
        "missing `Verify` command or GitHub workflow is informational",
        "At or above 20,000 bytes, call it oversized",
        "lets skills load the overview, active",
        "Claude uses legacy direct context imports",
        "review.independentExecution",
        "Independent review defaults to `when-sensitive`",
        "defaults to\n     `automatic`",
        "Accept equivalent guidance anywhere in the file; do not require exact prose",
        "A heading or a single slogan is not sufficient",
        "warning, not a setup blocker. The updater preserves existing `AGENTS.md`",
        "merge only the missing guidance into the project's `AGENTS.md`",
        "existing project rules and equivalent customized wording",
        "keep `AGENTS.md` public-safe without adding hidden workflow paths or skill lists",
        "Doctor must not edit or replace `AGENTS.md`",
        "Follow the proportional-engineering contract in `AGENTS.md`",
        "healthy\n     unknown context, not an incomplete requirement"
      ]
    ],
    [
      ".agents/skills/autopilot/SKILL.md",
      [
        "Follow the proportional-engineering contract in `AGENTS.md` throughout this run",
        "does not remove or change shipped behavior",
        "exact `Verify` command from `AGENTS.md`",
        "combines `/feature` or `/fix` with `/implement`",
        "option to walk through the completed code",
        "automatic isolated reviewer",
        "existing configured checkpoint authority",
        "local `Spec snapshot` contract without changing visibility",
        "Do not create an empty commit for ignored spec changes",
        "The request records `Requested execution`",
        "pending request without `Requested execution` is legacy manual-only"
      ]
    ],
    [
      ".agents/skills/continuous/SKILL.md",
      [
        "Follow the proportional-engineering contract in `AGENTS.md` throughout this run",
        "does not remove or change shipped behavior",
        "Run the exact documented `Verify` command",
        "one clean local main commit per completed feature",
        "Never push the default branch",
        "required immutable independent-review checkpoints",
        "automatic capability cannot prove isolation",
        "local `Spec snapshot` contract without changing visibility",
        "Do not create an empty commit for ignored spec changes",
        "The request records `Requested execution`",
        "pending request without `Requested execution` is legacy manual-only",
        "../complete/reference/completion-recovery.md",
        "never counts the same completion twice",
        "Use the exact `**Branch:**` frozen in the spec"
      ]
    ],
    [
      ".agents/skills/onboard/SKILL.md",
      [
        "Independent review defaults to `when-sensitive`",
        "execution defaults to `automatic`",
        "disables\nautomatic selection for that workflow without disabling explicit independent\naudits",
        "Follow and preserve the proportional-engineering contract in `AGENTS.md`"
      ]
    ],
    [
      "AGENTS.md",
      [
        "## Proportional engineering",
        "Unknown scale or extensibility defaults to the smaller reversible design",
        "Derive trust and data-integrity boundaries from actual reachability",
        "Ask only when an unknown materially changes behavior",
        "Stack-specific template standards apply only when the project uses that stack",
        "## Automatic verification",
        "`contents: read`",
        "spawns a generic child through the current runtime",
        "never requires or discovers global agent roles",
        "Independent review defaults to `when-sensitive`",
        "Its default, `automatic`"
      ]
    ],
    [
      "blueprint/project-plan.md",
      [
        "## 9. Usage model and constraints (optional)",
        "Unknown does not mean enterprise, hostile, multi-tenant, or single-user"
      ]
    ],
    [
      "README.md",
      [
        "## Automatic GitHub checks",
        "**Verify is the recipe.**",
        "generic child of the current runtime",
        "No global agent role",
        "Independent review defaults to `when-sensitive`",
        "defaults to\n`automatic`"
      ]
    ],
    [
      "blueprint/context/coding-standards.md",
      ["treat it as the umbrella automated"]
    ],
    [
      "blueprint/context/ai-interaction.md",
      [
        "run that exact command as the final automated gate",
        "Continuous Mode also exists only as an explicit opt-in command",
        "The initial Overview baseline also requires explicit approval",
        "the same approval can finalize the local baseline",
        "generic child through the current runtime",
        "never depends on a global role"
      ]
    ],
    [
      "packages/create-ai-blueprint/README.md",
      [
        "optional `/ci` or `$ci` skill",
        "offers a reviewed local commit for the Blueprint setup and plans",
        "Claude Code and Codex selected by default",
        "generic child of the current runtime",
        "does not require or discover a global agent role"
      ]
    ]
  ]);

  for (const [relativePath, phrases] of requirements) {
    const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    const normalizedContent = content.replace(/\s+/g, " ");

    for (const phrase of phrases) {
      const normalizedPhrase = phrase.replace(/\s+/g, " ");

      if (!normalizedContent.includes(normalizedPhrase)) {
        throw new Error(`Verification contract missing from ${relativePath}: ${phrase}`);
      }
    }
  }
}

async function validateCanonicalStubs(): Promise<void> {
  const [currentFeature, findings, review, completeSkill] = await Promise.all([
    fs.readFile(path.join(repoRoot, "blueprint/context/current-feature.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "blueprint/context/findings.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "blueprint/context/review.md"), "utf8"),
    fs.readFile(path.join(codexSkillsRoot, "complete", "SKILL.md"), "utf8")
  ]);

  if (normalizeEol(currentFeature) !== currentFeatureStub) {
    throw new Error("Current feature stub must exactly match the canonical content and final newline");
  }

  if (normalizeEol(findings) !== findingsStub) {
    throw new Error("Findings stub must exactly match the canonical content and final newline");
  }

  if (normalizeEol(review) !== reviewStub) {
    throw new Error("Independent review stub must exactly match the canonical content and final newline");
  }

  if (!normalizeEol(completeSkill).includes(indentMarkdownBlock(currentFeatureStub))) {
    throw new Error("Complete skill must embed the canonical current feature stub");
  }

  if (!normalizeEol(completeSkill).includes(indentMarkdownBlock(findingsStub))) {
    throw new Error("Complete skill must embed the canonical findings stub");
  }
  if (!normalizeEol(completeSkill).includes(indentMarkdownBlock(reviewStub))) {
    throw new Error("Complete skill must embed the canonical independent review stub");
  }
}

// Markdown is not pinned in .gitattributes, so Windows checkouts see CRLF here.
function normalizeEol(content: string): string {
  return content.replaceAll("\r\n", "\n");
}

function indentMarkdownBlock(content: string): string {
  return content
    .split("\n")
    .map((line) => (line ? `    ${line}` : ""))
    .join("\n");
}

async function validateClaudeImports(): Promise<number> {
  const content = await fs.readFile(path.join(repoRoot, "CLAUDE.md"), "utf8");
  const imports = [...content.matchAll(/^@(.+)$/gm)].map((match) => match[1].trim());
  const expectedImports = ["AGENTS.md"];

  assertEqualLists(imports, expectedImports, "Claude core imports");

  for (const relativePath of imports) {
    assertSafeRelativePath(relativePath);
    await requirePath(
      path.join(repoRoot, ...relativePath.split("/")),
      `CLAUDE.md import ${relativePath}`
    );
  }

  return imports.length;
}

async function validateSkillReferences(adapterFiles: readonly string[]): Promise<number> {
  let count = 0;

  for (const relativePath of adapterFiles.filter((file) => file.endsWith("SKILL.md"))) {
    const skillFile = path.join(codexSkillsRoot, ...relativePath.split("/"));
    const content = await fs.readFile(skillFile, "utf8");
    const references = [
      ...content.matchAll(/`(reference\/[A-Za-z0-9._/-]+)`/g)
    ].map((match) => match[1]);

    for (const reference of new Set(references)) {
      assertSafeRelativePath(reference);
      await requirePath(
        path.join(path.dirname(skillFile), ...reference.split("/")),
        `${relativePath} reference ${reference}`
      );
      count += 1;
    }
  }

  return count;
}

async function validatePackageMetadata(): Promise<void> {
  const packageRoot = path.join(repoRoot, "packages", "create-ai-blueprint");
  const metadata = parseRecord(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8"),
    "Package metadata"
  );
  const requiredFiles = [
    "dist/",
    "template/",
    "README.md",
    "LICENSE",
    "package.json"
  ];
  const requiredScripts = ["test", "prepare-template", "prepack", "postpack"];

  const bin = typeof metadata.bin === "object" && metadata.bin !== null
    ? metadata.bin as Record<string, unknown>
    : {};
  const packageFiles = stringArray(metadata.files);
  const scripts = typeof metadata.scripts === "object" && metadata.scripts !== null
    ? metadata.scripts as Record<string, unknown>
    : {};

  if (bin["create-ai-blueprint"] !== "dist/bin/create-ai-blueprint.js") {
    throw new Error("Package bin entry does not point to the installer CLI");
  }

  for (const requiredFile of requiredFiles) {
    if (!packageFiles.includes(requiredFile)) {
      throw new Error(`Required package entry is missing: ${requiredFile}`);
    }
  }

  for (const script of requiredScripts) {
    if (typeof scripts[script] !== "string" || scripts[script].length === 0) {
      throw new Error(`Package script is missing: ${script}`);
    }
  }

  if (metadata.license !== "MIT") {
    throw new Error("Package license must be MIT");
  }

  if (metadata.homepage !== "https://ai-blueprint.dev") {
    throw new Error("Package homepage must point to the official site");
  }

  if (metadata.author !== "Brad Traversy") {
    throw new Error("Package author metadata is missing");
  }

  for (const keyword of [
    "ai-coding",
    "claude-code",
    "context-engineering",
    "spec-driven-development"
  ]) {
    if (!stringArray(metadata.keywords).includes(keyword)) {
      throw new Error(`Package keyword is missing: ${keyword}`);
    }
  }

}

async function validateRepositoryPolish(): Promise<void> {
  const [rootLicense, packageLicense, packageMetadata, changelog, publishWorkflow] =
    await Promise.all([
      fs.readFile(path.join(repoRoot, "LICENSE")),
      fs.readFile(path.join(repoRoot, "packages", "create-ai-blueprint", "LICENSE")),
      fs.readFile(
        path.join(repoRoot, "packages", "create-ai-blueprint", "package.json"),
        "utf8"
      ),
      fs.readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8"),
      fs.readFile(path.join(repoRoot, ".github", "workflows", "publish.yml"), "utf8")
    ]);

  if (!rootLicense.equals(packageLicense)) {
    throw new Error("Root and npm package license files differ");
  }

  const version = parseRecord(packageMetadata, "Package metadata").version;

  if (typeof version !== "string") {
    throw new Error("Package metadata has no valid version");
  }

  if (!changelog.includes(`## [${version}]`)) {
    throw new Error(`CHANGELOG.md does not include package version ${version}`);
  }

  if (!publishWorkflow.includes("gh release create")) {
    throw new Error("Publish workflow does not create a GitHub release");
  }

  const preview = await fs.readFile(path.join(repoRoot, "assets", "social-preview.png"));

  if (preview.length >= 1_000_000) {
    throw new Error("Social preview must remain under 1 MB");
  }

  if (
    preview.toString("ascii", 1, 4) !== "PNG" ||
    preview.readUInt32BE(16) !== 1280 ||
    preview.readUInt32BE(20) !== 640
  ) {
    throw new Error("Social preview must be a 1280x640 PNG");
  }
}

async function requirePath(absolutePath: string, label: string): Promise<void> {
  try {
    await fs.access(absolutePath);
  } catch (error: unknown) {
    if (errorCode(error) === "ENOENT") {
      throw new Error(`Required path is missing: ${label}`);
    }

    throw error;
  }
}

function assertEqualLists(expected: readonly string[], actual: readonly string[], label: string): void {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `${label} mismatch. Expected [${expected.join(", ")}], received [${actual.join(", ")}].`
    );
  }
}

function assertSafeRelativePath(relativePath: string): void {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));

  if (
    normalized !== relativePath ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Unsafe repository reference: ${relativePath}`);
  }
}

main().catch((error: unknown) => {
  console.error(
    `Static contract failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
