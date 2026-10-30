---
name: ci
description: Set up or normalize one project Verify command and matching GitHub Actions checks while preserving existing CI, with an optional local pre-push hook. Use for /ci, GitHub Actions setup, pull-request checks, automatic checks, pre-push hooks, or aligning typecheck, test, and build verification.
---

# ci - set up automatic GitHub checks

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` when `blueprint/.state/`
exists. From the project root, run the first helper that exists,
`node .agents/skills/blueprint-doctor/scripts/run-state.mjs` or
`node .claude/skills/blueprint-doctor/scripts/run-state.mjs`, with `start --command
<skill> --summary "<truthful summary>" --boundary
<read-only|reviewed|local-only>`. Use `update` at milestones, with `--status
blocked --resume <command>` for a blocker, and `finish --status ready|completed`
at the end; `--help` lists every option and `blueprint/workflow.md` has the full
activity contract. A missing or failing helper is a warning, not a blocker.

Where this sits in the workflow:

    /onboard or /adopt  ->  [ci]  ->  Verify locally  ->  GitHub runs Verify
    (project commands)     (setup)    (same recipe)      (pull requests)

This skill gives local work and GitHub one shared automated command. It is an
optional setup task, not a requirement for using the Blueprint.

Keep the beginner explanation simple:

- **Verify is the recipe.** It runs checks the project already has.
- **GitHub Actions is the worker.** It runs the same recipe automatically.
- **A GitHub ruleset is the lock.** That optional remote setting can require the
  worker to report green before merge.
- **A pre-push hook is the early warning.** That optional local setting runs the
  recipe before a push leaves the machine. It is a convenience, not the lock:
  `git push --no-verify` skips it.

This skill configures the recipe and worker, and adds the hook only when the
user opts in. It never changes the remote ruleset, pushes, publishes, or deploys.

## Input

No argument is required. A named provider or workflow preference is a request to
review, not permission to replace existing CI. This skill's default provider is
GitHub Actions because it creates GitHub pull-request checks.

## Step 1 - inspect without changing files

Read enough to identify the real project setup:

- `AGENTS.md`, especially Commands and any documented `Verify` command
- package or language manifests and task-runner files
- lockfiles and the package manager they imply
- existing typecheck, test, build, lint, and other quality commands
- test configuration and actual test files
- runtime version files such as `.nvmrc`, `.node-version`, `.python-version`,
  `go.mod`, or `rust-toolchain.toml`
- `.github/workflows/` and any documented external CI
- git's current branch, configured default branch, and remotes when available

Do not assume npm, Node.js, `main`, or GitHub from the Blueprint template. Do not
run installs or edit files during inspection.

If an existing workflow already provides equivalent pull-request checks, explain
what it runs. If it is healthy and aligned with a documented Verify command,
report that no setup is needed. If normalization would change existing CI, show
the proposed change and get explicit approval before editing it.

## Step 2 - define one Verify command

Build one command from meaningful checks that actually exist, in this order:

1. typecheck
2. tests, only when a runner and real test command are configured
3. build

Omit missing checks. Do not install a test runner, invent an empty test suite, or
add a placeholder command. Lint, formatting, coverage, browser tests, security
scans, dependency audits, and version matrices are not part of the beginner
default. Preserve them when existing CI already requires them, and discuss any
normalization before changing that behavior.

For JavaScript and TypeScript, add or reuse a package script named `verify` and
invoke it with the detected package manager. For other stacks, use the existing
native task runner or the smallest clear combined command. Document the exact
invocation as `Verify` in the Commands section of `AGENTS.md`.

Examples are explanatory only. Never copy them without detecting the project:

```text
Verify: npm run verify
Verify: make verify
Verify: cargo test && cargo build --locked
```

If no meaningful check exists, stop and explain what is missing. Do not create a
workflow that always passes.

## Step 3 - create or align the workflow

Create `.github/workflows/verify.yml` only when that path is free. If it already
exists, never overwrite it silently. Show the exact proposed diff and ask before
changing it.

The workflow should contain only what the detected project needs:

- a clear workflow name such as `Verify`
- `pull_request`
- pushes to the detected default branch
- `permissions: contents: read`
- the real runtime version
- checkout and the appropriate runtime setup action
- the lockfile-safe dependency install command
- one final step that runs the exact `Verify` command from `AGENTS.md`

If the default branch cannot be identified from git or project context, ask
before writing the push trigger instead of guessing. Preserve all other workflow
files. When another workflow overlaps, report the overlap and ask whether to
reuse, align, or leave it alone.

## Step 3b - offer a local pre-push hook (opt-in)

After the workflow exists, ask one question and default to no:

    Also add a local pre-push hook that runs Verify before every push? [y/N]

Skip the question when the request already answered it (for example "/ci with
hook" or "no hook"). When the answer is no, write nothing and move on. When it
is yes:

1. Write `.githooks/pre-push` (mode 755) that announces itself and then runs
   the exact `Verify` command from `AGENTS.md` with `exec`, so the command's
   exit code is the hook's exit code.
2. Point git at the folder: `git config core.hooksPath .githooks`.
3. For JavaScript and TypeScript projects, add a `prepare` script,
   `git config core.hooksPath .githooks 2>/dev/null || true`, so a fresh
   install wires the hook without a manual step. The `|| true` keeps installs
   working where no git checkout exists, such as a deploy build. For other
   stacks, document the `git config` line in the README instead.
4. Run the hook once (`.githooks/pre-push`). If it fails, remove what this
   step added and report the failing subcommand. Never leave a hook the
   project cannot pass.

The hook and the workflow run the same `Verify` command; if one changes, the
other changes with it. Say in the report that `--no-verify` bypasses the hook,
so the GitHub ruleset remains the lock.

## Step 4 - prove the setup locally

Run the exact documented `Verify` command locally. The individual build, test,
or typecheck commands may still be run separately for diagnosis, but the final
proof must use Verify because that is what GitHub will run.

A passing local run proves the recipe against the current working copy. It does
not prove dependency installation or command behavior from a fresh checkout.
Until the workflow is pushed and reports green on GitHub, describe the setup as
prepared locally, not CI verified. The first successful GitHub run is the
authoritative clean-checkout proof.

If Verify fails, report the failing subcommand and stop. Do not weaken the
command, remove a legitimate check, or describe CI as ready.

Do not push the workflow. A local workflow file does nothing on GitHub until the
user later approves a push.

## Step 5 - report

Finish with a concise setup report:

- existing CI found and whether it was preserved or changed
- exact `Verify` command
- checks included and checks omitted
- test gate status
- workflow path and triggers
- whether a pre-push hook was added, and that `--no-verify` bypasses it
- local Verify result and whether CI is only prepared locally or confirmed by a
  successful GitHub run
- files changed
- any overlap, uncertainty, or follow-up

Explain that making the GitHub check required is a separate remote ruleset choice
after the workflow is pushed. Do not change repository settings or treat that as
part of this skill.

## Interaction with other skills

- `/tests` adds the real test command to an existing Verify command, but never
  creates CI by itself.
- `/implement`, `/complete`, and `/autopilot` run Verify when it is documented,
  with their existing fallback behavior when it is absent.
- `/blueprint-doctor` diagnoses drift between `AGENTS.md`, the project command, and the
  workflow. Missing CI remains informational.

## Rules

- Preserve existing CI and custom checks.
- Never invent tests or install a runner as part of CI setup.
- Never add coverage, browser tests, security scans, or matrices by default.
- Add a git hook only through the Step 3b opt-in, never silently.
- Never push or change a remote ruleset without separate explicit approval.
- Keep one exact Verify command shared by local work and GitHub.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
