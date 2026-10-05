---
name: doctor
description: Run a Blueprint health and context check covering setup, adapters, commands, visibility, plans, overview freshness, configuration, dashboard state, and workflow drift. May offer to reset malformed generated dashboard state after approval. Use for /doctor, installation checks, context overhead, setup problems, or when something feels wrong.
disable-model-invocation: true
---

# doctor - Blueprint health check

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Where this sits in the workflow:

    any time  ->  [doctor]  ->  reads setup + plans + workflow state + git
                  (diagnostic)  prints health, warnings, and repair order

This skill answers one question: *is this Blueprint project ready to use?* It is
the diagnostic pass for setup drift, incomplete onboarding, missing files,
placeholder plans, stale generated context, Blueprint visibility, and confusing
workflow state. It never changes anything: no edits, no commits, no installs, no
builds, no branch changes. Its only repair is an approved reset of a malformed
generated `blueprint/.state/run.json` file.

Use `/status` when the user mainly wants progress and the next build action. Use
`/doctor` when the user wants to know whether the workflow itself is healthy.

## Input

None. `/doctor` takes no argument.

## What it checks

Gather these, then summarize. Do not dump file contents.

1. **Required Blueprint files**
   - Confirm `AGENTS.md`, `blueprint/`, `blueprint/project-plan.md`,
     `blueprint/build-plan.md`, and `blueprint/context/` exist.
   - Confirm `blueprint/context/coding-standards.md`,
     `blueprint/context/ai-interaction.md`,
     `blueprint/context/current-feature.md`, and
     `blueprint/context/project-overview.md` exist.
   - Confirm `blueprint/history/features/` and `blueprint/history/fixes/` exist.
     When the rollback skill is installed, also check
     `blueprint/history/rollbacks/`. A missing rollback folder on a legacy
     installation is a warning, not a blocker; `/complete` creates it on the
     first rollback.
   - Check `blueprint/context/findings.md`. Missing on a legacy installation is
     a warning, not a blocker; `/audit` and `/complete` create it on first use.
     When present, confirm its entry headers still match
     `### <id> [<severity>] <status> - <title>` and warn on a malformed ledger.
     Report any P0 or P1 finding still `open` or `fixed` by ID, since it will
     block `/complete`. Never block on the ledger yourself.
   - Check `blueprint/context/review.md`. Missing on a legacy installation is a
     warning, not a blocker; `/audit independent current` and `/complete` create
     it on first use. When present, validate the required request or receipt
     fields and report pending, changes-requested, malformed, or stale state.
   - If `.gitignore` marks Blueprint workflow files as local-only, still require
     the files to exist on disk. Ignored but present is healthy; ignored and
     missing means the local workflow needs to be restored.
   - Read `blueprint/config.json` when present. Missing is healthy and means
     built-in defaults. When present, require a regular non-symbolic-link JSON
     file with `schemaVersion: 1`. Reject unknown keys and unsupported values.
     Report the effective workflow, git, verification, review execution, regular
     quality-gate, Continuous quality-gate, and Continuous Mode settings. Confirm each audit,
     independent-review, check, and try-guide gate uses its supported values.
     Independent review defaults to `when-sensitive` for both workflows; audit,
     check, and try guide default to `manual`. Confirm
     `review.independentExecution` is `manual` or `automatic` and defaults to
     `automatic`. Do not claim automatic capability is available from installed
     project files alone.
     An invalid config is a setup blocker for mutating workflow skills because
     they must not guess which policy to follow.
2. **Tool adapters**
   - Read `blueprint/.state/manifest.json` when present and report its exact
     logical adapters. Supported values include Codex, Claude Code, and GitHub
     Copilot. Google Antigravity and OpenCode are supported too.
   - Confirm at least one compatible skill tree exists. Codex, GitHub Copilot,
     and Google Antigravity use `.agents/skills/`. Claude Code uses
     `.claude/skills/`. OpenCode can use either tree.
   - If both skill trees are present, say that is healthy when the selected
     tools require both. Compare their skill folder names and warn about missing
     skills on either side.
   - If OpenCode is selected, do not require `.opencode/skills/`. If it contains
     duplicate Blueprint skills alongside `.agents/skills/` or `.claude/skills/`,
     warn that OpenCode discovers all of those locations and the duplicate tree
     should be reviewed.
   - If git shows changes under `.agents/skills/` or `.claude/skills/`, check
     the matching adapter file too. Warn when workflow behavior was updated in
     one adapter but not the other.
   - Confirm each installed adapter tree contains
     `doctor/scripts/run-state.mjs`. This managed helper validates and atomically
     writes dashboard activity. A missing helper needs a Blueprint update before
     tracked commands can record activity safely.
   - If only one tool is used, mention the unused adapter can be deleted. Do not
     treat extra adapters as an error.
   - If `CLAUDE.md` exists and still starts with `# Project Name`, flag that
     `/onboard` probably has not finished.
   - When Claude Code is installed, report its startup-context shape. Confirm
     `CLAUDE.md` imports `AGENTS.md` and lets skills load the overview, active
     spec, coding standards, and interaction guide on demand. If it directly
     imports any of those four context files, warn that this is the legacy
     always-loaded layout and give the exact direct import lines to remove.
     Count the imported files and their total byte size, plus the total byte
     size of project skill descriptions. Label these as file-size diagnostics,
     not token counts. Recommend Claude Code's `/context all` for the live token
     breakdown.
3. **Commands and project setup**
   - Read existing `AGENTS.md` for substantive proportional-engineering guidance,
     under `## Proportional engineering` or equivalent customized wording.
     Accept equivalent guidance anywhere in the file; do not require exact prose.
     Look for current requirements over hypothetical scale, reuse before new
     machinery, smaller reversible defaults, questions for material unknowns,
     and trust boundaries grounded in actual reachability. Simplicity must
     preserve real validation, data-loss prevention, accessibility, security,
     configured tests, and project rules; stack-specific standards apply only
     to the project's stack. A heading or a single slogan is not sufficient.
     If guidance is missing or incomplete, identify the missing substance as a
     warning, not a setup blocker. The updater preserves existing `AGENTS.md`,
     so updating Blueprint alone does not repair this warning.
   - Check whether root `README.md` is still the copied Blueprint workflow doc
     by looking for `# AI Coding Blueprint` or opening text that describes the
     Blueprint workflow instead of the app. If so, warn that `/onboard` should
     replace it with a project README before publishing.
   - If `blueprint/README.md` clearly contains copied Blueprint workflow docs,
     report it as an obsolete installer artifact. Its absence is healthy. An
     unchanged managed copy can be removed by the updater; a modified copy needs
     user review.
   - Check whether `AGENTS.md` has a `## Commands` section with dev and build
     commands.
   - Report missing lint or test commands as informational unless the project has
     real lint or test scripts elsewhere that are not reflected in `AGENTS.md`.
   - If `package.json` exists, compare its scripts against `AGENTS.md` at a high
     level. Do not require every script to be documented.
   - If `AGENTS.md` declares a `Verify` command, confirm it resolves to real
     project commands in the expected order: typecheck, tests when configured,
     then build. Do not require checks the project does not have.
   - If `.github/workflows/verify.yml` exists, confirm it runs the exact documented
     `Verify` command for pull requests and pushes to the default branch, uses the
     detected runtime and package manager, and starts with read-only contents
     permission. Preserve other workflows and report overlap for review.
   - A missing `Verify` command or GitHub workflow is informational. It means the
     optional automatic-check setup was not selected, not that the Blueprint is
     unhealthy.
4. **Ignore rules**
   - Check obvious ignore patterns for the detected stack. For Node or Astro,
     look for `node_modules`, `.env`, `dist`, and framework cache folders such as
     `.astro` or `.next` when relevant.
   - Detect local-only Blueprint mode if `.gitignore` ignores `.agents/`,
     `.claude/`, `blueprint/`, or `CLAUDE.md`. Report it as a visibility choice,
     not a failure, when the local files exist.
   - In local-only mode, check whether tracked `AGENTS.md` still describes the
     Blueprint workflow, lists hidden adapter paths, or exposes the core skill
     list. If so, warn that `/onboard` should make `AGENTS.md` public-safe.
   - If local-only mode is active but those paths are already tracked by git,
     warn that `.gitignore` does not hide tracked files and the user must approve
     any `git rm --cached` cleanup separately.
   - Keep this conservative. If uncertain, report "review" instead of failure.
5. **Planning readiness**
   - Check whether `blueprint/project-plan.md` and `blueprint/build-plan.md` look
     filled in or still template-like. Treat obvious TODO, TBD, example-only text,
     or empty required sections as not ready.
   - Follow the proportional-engineering contract in `AGENTS.md`: treat a blank
     or template-only optional Usage model and constraints section as healthy
     unknown context, not an incomplete requirement.
   - Check whether `blueprint/build-plan.md` is a numbered checkbox list. Raw
     bullets are allowed as a first draft, but they should be normalized by
     `/overview` before the build loop starts.
   - Count checked and unchecked leaf items in `blueprint/build-plan.md`.
6. **Overview freshness**
   - Check whether `blueprint/context/project-overview.md` exists and looks
     generated from the current plans.
   - Report its byte size. At or above 20,000 bytes, call it oversized and say
     `/feature` should stop until `/overview` regenerates a compact
     consolidation.
   - If either planning file appears newer than the overview by filesystem time,
     call the overview possibly stale and suggest `/overview` before feature work.
7. **Current workflow state**
   - Inspect `blueprint/.state/run.json` when it exists. Missing means no recorded
     activity and is healthy. Require a regular non-symbolic-link JSON file that
     matches dashboard schema version 1 from `AGENTS.md`.
   - If the path is a symbolic link or not a regular file, do not read, replace,
     or remove it. Report the exact path for manual review.
   - If the regular file is invalid JSON or does not match the schema, report it
     as malformed generated state. Explain that resetting it removes only the
     dashboard's last-command record, not project work, and that the next tracked
     Blueprint command recreates it.
   - Offer this exact repair question: `Reset the malformed dashboard state now?`
     On approval, use the installed dashboard activity helper's `reset` action.
     It confirms the exact path is a regular non-symbolic-link file and removes
     only `blueprint/.state/run.json`. Verify the file is absent and report the
     dashboard state as reset. Never remove `blueprint/.state/`, its manifest,
     backups, or any project file. Without approval, leave it unchanged and
     include the reset in `Repair order:`.
   - Check whether `blueprint/context/current-feature.md` is the reset stub or an
     active feature, fix, or rollback spec.
   - If a spec is active, report checked and unchecked implementation steps.
   - If `current-feature.md` is the reset stub but git has source or workflow
     changes, warn that work is happening without an active spec.
   - Flag active spec on `main`, all spec steps checked but no completion, or a
     branch that does not match the configured feature, fix, or rollback prefix
     for the spec type. For a feature using `git.landing: "local-merge"`, also
     flag a mismatch with the next unchecked build-plan item. Pull-request
     landing permits another unchecked feature because parallel branches can be
     active. For a rollback, confirm its target is a checked item and do not
     compare it to the next unchecked item.
8. **Git**
   - Report current branch, clean vs dirty working tree, rough changed-file count,
     last commit subject, and whether the branch is ahead of upstream.
   - If the directory is not a git repo, report that as a setup issue and keep
     going.
   - When `git.landing` is `pull-request`, report the configured remote, resolved
     remote default branch, and whether an authenticated hosting CLI or API is
     available. Missing pull-request prerequisites need attention but do not make
     the local Blueprint workflow unhealthy.

## Output

Print a compact health report with these labels:

    Health: Pass | Needs attention | Blocked
    Setup: ...
    Configuration: ...
    Verification: ...
    Adapters: ...
    Context: ...
    Visibility: ...
    Plans: ...
    Workflow: ...
    Git: ...
    Watch: ...
    Repair order: ...

Use `Watch:` only when there are warnings. Use `Repair order:` for the exact next
steps, in order. Keep it short and practical.

Choose the repair order in this priority:

- Required Blueprint files missing -> overlay the Blueprint again, or use
  `/adopt` for a brownfield app.
- Invalid `blueprint/config.json` -> fix the named key or value, then rerun
  `/doctor`. Do not mutate project work while configuration is ambiguous.
- No git repo -> initialize git before using the build loop.
- No tool adapter -> restore `.agents/skills/` or `.claude/skills/` for the
  selected tool. OpenCode can use either compatible tree.
- Installed adapter is missing `doctor/scripts/run-state.mjs` -> update
  Blueprint before relying on dashboard activity.
- Claude uses legacy direct context imports -> remove the exact direct imports
  for `project-overview.md`, `current-feature.md`, `coding-standards.md`, and
  `ai-interaction.md` that are present in `CLAUDE.md`, then rerun `/doctor`. The
  files stay in the project and workflow skills still read them on demand.
- Onboarding incomplete -> run `/onboard`.
- Proportional-engineering guidance missing or incomplete -> review the current
  Blueprint template's `AGENTS.md` Proportional engineering section and manually
  merge only the missing guidance into the project's `AGENTS.md`. Preserve
  existing project rules and equivalent customized wording. In local-only mode,
  keep `AGENTS.md` public-safe without adding hidden workflow paths or skill lists.
  Doctor must not edit or replace `AGENTS.md`.
- Root README is still the Blueprint workflow doc -> run `/onboard` to replace
  it with a project README before publishing.
- Local-only visibility selected but ignored Blueprint files are missing ->
  reinstall or restore the Blueprint files locally.
- Local-only visibility selected but Blueprint paths are tracked -> ask whether
  to untrack them with `git rm --cached` while keeping local files.
- Local-only visibility selected but `AGENTS.md` still exposes the workflow ->
  run `/onboard` to make `AGENTS.md` a lightweight public project guide.
- A documented `Verify` command, project script, and GitHub workflow disagree ->
  run `/ci` to review and align them. Missing optional CI alone does not need
  repair.
- Commands or ignore rules need review -> update the files or run `/onboard` if
  this is an early project.
- Plans are placeholders -> fill `blueprint/project-plan.md` and
  `blueprint/build-plan.md`.
- Overview missing or stale -> run `/overview`.
- Malformed regular `blueprint/.state/run.json` -> offer to reset that exact
  generated file, then rerun `/doctor` or refresh the dashboard.
- Active spec has unchecked steps -> run `/status` or `/implement`, depending on
  whether the user wants orientation or action.
- A P0 or P1 finding is `open` -> repair it through `/implement` while a spec
  is active, or `/fix <finding id>` between work items. One that is `fixed` ->
  `/audit` to re-review and close it. Both come before suggesting `/complete`.
- Active spec is done but not closed -> run `/check`, then `/complete`.
- Everything is healthy -> say so, then suggest `/status` for progress or
  `/feature` for the next planned feature.

## Rules

- **Diagnostic by default.** This skill never edits project files, commits, runs
  installs, runs builds or tests, or switches branches. It may remove only a
  malformed regular `blueprint/.state/run.json` through the installed helper
  after the user approves the exact reset described above.
- **Diagnose, then order repairs.** Do not just list problems. End with the
  smallest ordered sequence that gets the project back to a healthy state.
- **Do not over-police adapters.** Extra adapters are optional clutter, not a
  failure.
- **Be conservative with stack-specific checks.** If a command or ignore pattern
  is uncertain, mark it for review instead of inventing a hard failure.
- **Stay concise.** A doctor pass should feel like a checklist, not an audit.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
