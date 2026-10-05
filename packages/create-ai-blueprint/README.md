# create-ai-blueprint

AI Blueprint is a file-backed control system for AI-assisted development. It
gives coding agents a shared workflow to plan, build, verify, and document one
feature at a time, with human review gates before code changes and merges.

It works with any stack and installs inside an app you have already scaffolded.
Plans, specs, project context, findings, configuration, and completed-work
history stay as readable files in your repository.

Across that workflow, proportional-engineering guidance keeps plans and code
limited to current requirements. It prefers existing project and platform
capabilities before new machinery while preserving real trust and data-integrity
boundaries.

[![npm version](https://img.shields.io/npm/v/create-ai-blueprint?style=flat-square&color=155eef)](https://www.npmjs.com/package/create-ai-blueprint)
[![Validate Blueprint](https://github.com/aiblueprinthq/ai-blueprint/actions/workflows/validate.yml/badge.svg)](https://github.com/aiblueprinthq/ai-blueprint/actions/workflows/validate.yml)
[![MIT license](https://img.shields.io/npm/l/create-ai-blueprint?style=flat-square&color=155eef)](LICENSE)

[Official site](https://ai-blueprint.dev) |
[Documentation](https://ai-blueprint.dev/docs/) |
[Repository](https://github.com/aiblueprinthq/ai-blueprint) |
[Changelog](https://github.com/aiblueprinthq/ai-blueprint/blob/main/CHANGELOG.md)

Requires Node.js 22 or newer. Run the installer from an application that has
already been scaffolded and initialized as a Git repository.

Choose the command for your project's package manager:

```bash
# npm
npx create-ai-blueprint@latest

# pnpm
pnpm dlx create-ai-blueprint@latest
```

A project that enforces pnpm through `devEngines.packageManager` can reject
`npx` with `EBADDEVENGINES` before Blueprint starts. Use `pnpm dlx` in that
project; do not remove its package-manager requirement.

The remaining `npx create-ai-blueprint@latest` examples also work with
`pnpm dlx create-ai-blueprint@latest`, keeping the same command and options.


You can also use npm's initializer form:

```bash
npm create ai-blueprint@latest
```

The installer copies the Blueprint workflow files into the current directory:

- `AGENTS.md`
- `CLAUDE.md`
- `blueprint/config.json`
- `blueprint/.state/manifest.json`
- `.agents/`
- `.claude/`
- `blueprint/`

It keeps the app's root `README.md` alone.

See [Commit and PR attribution](https://github.com/aiblueprinthq/ai-blueprint/blob/main/blueprint/context/ai-interaction.md#commit-and-pr-attribution)
for the rule for all AI tools and optional settings that reduce unwanted AI signatures.

## Core workflow

Run installation and update commands in your terminal. Run workflow skills in
your AI coding chat. Use `/feature` in Claude Code or Google Antigravity, and use
`$feature` in Codex. Other tools can run the named skill through plain language.
`blueprint feature` does not run the Feature skill.
Use `npx create-ai-blueprint@latest status --help` for focused terminal help.

Learn the feature loop:

```text
/feature -> /implement -> /check -> /audit current -> /complete
```

Blueprint starts with your plans:

1. Run `/onboard` or `$onboard` to tune Blueprint to the real project.
2. Write `blueprint/project-plan.md` and `blueprint/build-plan.md` directly, or
   use the optional discovery skill to develop them through conversation.
   A plain feature list is enough for the build plan.
3. Run `/overview` or `$overview` to format that list into a tracked checklist
   without changing its scope or order, then generate durable project context.
   Formatting needs no extra approval; unclear scope or order does. On the first
   run, it offers a reviewed local commit for the Blueprint setup and plans.
4. Run `/feature` or `$feature` for the next planned feature, or use the fix
   skill for a focused bug or small change.
5. Review and approve the spec, then run `/implement` or `$implement` to build it in small,
   visible steps.
6. Run `/check` or `$check` to prove the behavior against the real app.
7. Use `/audit current` or `$audit current` to review the implementation for
   defects and record findings.
8. Run `/complete` or `$complete` to archive the work and request approval for
   the configured local merge or pull-request landing.

This teaching path does not change gate policy. Audit, Check, and manual-guide
gates default to `manual`; independent review defaults to `when-sensitive`.
Follow your configured gates; Audit is not mandatory for every feature.

Plans, current work, verification evidence, findings, and completed history stay
in the repository, so another session or supported coding tool can continue
from the same state.

## Parallel work

Blueprint keeps one active work item per checkout. To work in parallel, give
each developer or agent a separate clone or Git worktree with its own branch.
Run the normal workflow inside each checkout. Do not run two active work items
in the same working directory.

Create the worktree on the branch Blueprint will record. For a planned item
named `Export reports` with the default branch prefix:

```bash
git worktree add ../my-app-export-reports -b feature/export-reports main
```

Open the parallel AI session in that directory, then run `/feature "Export
reports"` there. Worktree creation remains an explicit Git operation; Blueprint
does not create or remove worktrees automatically.

Solo projects need no configuration change. Repositories that land through pull
requests can opt in through `blueprint/config.json`:

```json
"git": {
  "landing": "pull-request"
}
```

With that setting, `/complete` still runs the same gates and creates the same
work commit. It then asks for approval to push the work branch and open a pull
request. It never merges that request or enables auto-merge. The pull request
must be squash-merged so one work item remains one default-branch commit.

Parallel branches can still conflict in `blueprint/build-plan.md`; resolve that
through the normal pull-request integration flow. Blueprint does not add
per-item state folders or coordinate agents automatically.

## Tool support

| Tool | Installed adapter | Invocation |
| --- | --- | --- |
| Codex | `.agents/skills/` | `$feature`, `$implement`, or plain language |
| Claude Code | `.claude/skills/` | `/feature`, `/implement`, and other slash commands |
| GitHub Copilot | `AGENTS.md` and `.agents/skills/` | Ask Copilot to run the matching skill |
| Google Antigravity | `AGENTS.md` and `.agents/skills/` | `/feature`, `/implement`, and other slash commands |
| OpenCode | `AGENTS.md` and compatible `.agents/skills/` or `.claude/skills/` | Ask OpenCode to run the matching skill |
| Other tools | `AGENTS.md` plus readable skill files | Ask the agent to follow the matching `SKILL.md` |

If you install `--claude` or `--all` while Claude Code is already open in the
project, restart Claude Code in that folder so the newly added project skills
appear.

## Options

```bash
npx create-ai-blueprint@latest -- --codex
npx create-ai-blueprint@latest -- --claude
npx create-ai-blueprint@latest -- --copilot
npx create-ai-blueprint@latest -- --opencode
npx create-ai-blueprint@latest -- --antigravity
npx create-ai-blueprint@latest -- --codex --opencode
npx create-ai-blueprint@latest -- --all
npx create-ai-blueprint@latest -- --both
npx create-ai-blueprint@latest -- --force
npx create-ai-blueprint@latest -- --target ./my-app
npx create-ai-blueprint@latest update -- --codex
```

The same flags work with `npm create ai-blueprint@latest -- ...`.

The interactive installer shows a checkbox list with Claude Code and Codex
selected by default. GitHub Copilot and OpenCode remain available but unchecked.
Google Antigravity is also available and unchecked. Adapter flags are
composable, so scripts can select any combination.
`--both` remains as a deprecated alias for `--all` and prints a warning. GitHub
Copilot uses `AGENTS.md` and the shared `.agents/skills/` files; the installer
does not manage `.github/copilot-instructions.md`. Google Antigravity uses those
same `AGENTS.md` and `.agents/skills/` files. OpenCode reuses a compatible tree
instead of creating duplicate `.opencode/skills/` files.

Use `--force` to overwrite existing Blueprint files. Without `--force`, the
installer asks before overwriting in an interactive terminal and exits in
non-interactive runs.

## What do you need?

| What you want | Start here |
| --- | --- |
| "Would caching help this dashboard?" | `/explore would caching help our dashboard?` |
| "Explain feature 5 before we spec it." | `/brief 5` |
| "Build the next planned feature." | `/feature`, approve its spec, then `/implement` |
| "Something is broken and I don't know why." | `/debug` |
| "I know the bug or small change we need." | `/fix` |
| "Show that this feature works." | `/check` |
| "Tell me how to test it myself." | `/check guide` |
| "Review the implementation for defects." | `/audit current` |
| "Where did we leave off?" | `/status` |
| "Is Blueprint set up correctly?" | `/doctor` |

Explore investigates a possibility without requiring plans. Brief explains an
item already in the build plan. Neither writes files; Explore never executes
project code. Check exercises behavior against the spec. Check guide only gives
you instructions: it never runs checks, writes activity state, records acceptance,
or marks work verified. Audit reviews the code and
records findings; a clean review does not prove the application works.

## Command map

All 22 skills are installed for each selected adapter. These groups organize the
reference without adding configuration or optional installation modes. Use the
matching `$` form in Codex.

### Build

| Skill | Purpose |
| --- | --- |
| **/feature** | Turn one build-plan item into a spec for your approval. |
| **/implement** | Build the approved spec, then offer a code walkthrough. |
| **/check** | Verify real behavior against the spec. Use `/check guide` for a read-only manual walkthrough, or `/check guide latest` for completed work. |
| **/complete** | Run final gates, archive the work, and request approval for local merge or pull-request landing. |

### Understand and review

| Skill | Purpose |
| --- | --- |
| **/explore** | Investigate an idea against the code without writing files or requiring plans. |
| **/brief** | Explain an existing planned feature, its dependencies, and likely size without writing files. |
| **/status** | Show progress, drift, blockers, and the suggested next action. |
| **/debug** | Reproduce and isolate a failure without editing code. |
| **/audit** | Review code and record findings; `/audit independent current` requests an independent review of a checkpoint. |
| **/doctor** | Check Blueprint setup and workflow health; offer to reset malformed generated dashboard state after approval. |

### Plan and set up

| Skill | Purpose |
| --- | --- |
| **/onboard** | Tune a fresh Blueprint installation to the real project. |
| **/adopt** | Bring Blueprint into an existing codebase with shipped behavior. |
| **/discovery** | Develop the two planning documents through a reviewed conversation. |
| **/overview** | Generate durable project context from both planning documents. |
| **/prototype** | Create throwaway static mockups before implementation. |
| **/tests** | Set up unit testing with `/tests` or `/tests unit`; explicitly set up a browser harness with `/tests browser`. |
| **/ci** | Align one project Verify command with GitHub checks, plus an optional pre-push hook. |

### Recover and release

| Skill | Purpose |
| --- | --- |
| **/fix** | Write a spec for a small unplanned change or confirmed bug. |
| **/rollback** | Plan a history-preserving reversal of completed work. |
| **/release** | Prepare local Render or Vercel configuration and readiness checks; deployment needs separate approval. |

### Automation

| Skill | Purpose |
| --- | --- |
| **/autopilot** | Run one explicit spec and implementation pass through configured gates, stopping before completion. |
| **/continuous** | Complete reviewed build-plan items serially with local Git work; never push or deploy. |

The optional `/ci` or `$ci` skill uses the checks your project already has.
Browser testing requires an explicit `/tests browser` request; ordinary `/tests`
never installs it. See the [Command Guide](https://ai-blueprint.dev/docs/command-guide/)
for the full reference.

## Updating an existing installation

Preview the update plan:

```bash
# npm
npx create-ai-blueprint@latest update --dry-run

# pnpm
pnpm dlx create-ai-blueprint@latest update --dry-run
```

Apply the update:

```bash
# npm
npx create-ai-blueprint@latest update

# pnpm
pnpm dlx create-ai-blueprint@latest update
```

The updater detects the installed adapters and manages only these paths:

- `.agents/skills/`
- `.claude/skills/`

It preserves `AGENTS.md`, `CLAUDE.md`, project configuration, project and build
plans, context, history, references, and prototypes. An unchanged `blueprint/README.md` installed by an
older version is removed during update; a locally modified copy keeps the normal
conflict protection. The `blueprint/.state/manifest.json` file records the
installed version and hashes of managed files.

Update can also change the installed adapters. In an interactive terminal it
shows the adapter checkbox pre-filled with the installed adapters, so you can
check or uncheck tools before the plan is printed. `update --dry-run --yes`
previews the plan without the adapter prompt. Adapter flags such as
`update --codex` add adapters without a prompt and never remove an adapter.
Removing an adapter is interactive only; its managed skill files follow the
normal conflict and backup rules, and empty skill directories are pruned.
OpenCode shares its skill tree, so adding or removing Claude Code can move it
between `.agents/skills/` and `.claude/skills/`, and the plan says so. Adding
Claude Code creates `CLAUDE.md` from the template only when the file is
missing, and removing Claude Code never deletes it.

`blueprint/config.json` is user-owned project policy. It controls review cadence,
checkpoint availability, branch prefixes, verification strictness, independent-review execution, regular and
Continuous quality gates, and Continuous Mode limits. Audit, independent-review,
check, and try-guide gates use built-in defaults. Independent review defaults to
`when-sensitive` for regular and Continuous work, while audit, check, and try
guide default to `manual`. Sensitive or unusually broad work is selected for
independent review, while ordinary small features are not. Setting a workflow's
independent review policy to `manual` disables automatic selection; an explicit
`/audit independent current` still uses the configured execution method. A
missing file uses built-in defaults; an invalid file is reported by status and
blocks mutating workflow skills until `/doctor` identifies the repair.
Configuration never grants permission to
commit, merge, push, deploy, publish, or take destructive action. Only an
explicit `/continuous` or `$continuous` request starts the multi-feature loop.

`review.independentExecution` defaults to `automatic`, which uses a fresh
isolated reviewer child when a selected independent-review gate runs
and the active adapter can expose its exact reviewer identity and model. When it
cannot, Blueprint preserves the request and stops with the manual fresh-session
handoff. Set it to `manual` to always use that handoff. The setting changes
execution only; `qualityGates` still decides when independent review is selected.
The automatic reviewer is a generic child of the current runtime and reads the
installed project's Audit skill and review contract. Blueprint does not require
or discover a global agent role, skill, prompt, or TraversyFlow component.
New requests record requested execution and completed receipts record actual
execution. Automatic-to-manual fallback is explicit, and legacy receipts remain
compatible only as fresh-session manual reviews.

## Context efficiency

New installations make Claude Code import only `AGENTS.md` at startup. Explicit
workflow skills load the compact overview, active spec, coding standards, and
interaction guide on demand. Feature uses targeted repository reads and writes
one reviewed spec. Implement reuses that spec and normally runs the full Verify
command once after all steps. New project configuration also defaults to one
feature-level review packet with step checkpoint commits disabled.

The updater preserves `CLAUDE.md` and `blueprint/config.json`, so existing
projects do not receive those user-owned changes automatically. Run `/doctor` to
identify an oversized overview. The updater directly reports the obsolete
`project-overview.md` and `current-feature.md` import lines when they are present
in `CLAUDE.md`. Older layouts may also contain direct `coding-standards.md` and
`ai-interaction.md` imports, which the updater reports too. Remove every reported
line, restart Claude Code in the project, rerun `/overview` when needed, and
choose the lower-context defaults in `blueprint/config.json` if they fit the
project:

```json
"workflow": {
  "stepReview": "feature",
  "checkpointCommits": "disabled"
}
```

These settings are separate. `stepReview: "every"` restores the approval pause
after each implementation step, but it does not enable checkpoint commit prompts.
To match the previous workflow exactly, use:

```json
"workflow": {
  "stepReview": "every",
  "checkpointCommits": "enabled"
}
```

Context savings from the compact overview, on-demand project context, and
shorter skill descriptions still apply. Feature may pause when a missing choice
would define public behavior, security, persisted data, or interoperability. It
does not pause for reversible internal details with no current compatibility
surface.

Onboarding offers **Efficient**, **Guided**, and **Custom** implementation styles.
They write only the existing `stepReview` and `checkpointCommits` values, so no
additional mode is stored. You can edit either value later; the next Implement
run uses the current configuration.

Use `/context all` in Claude Code to inspect the live result. See the
[controlled benchmark](https://github.com/aiblueprinthq/ai-blueprint/blob/main/benchmarks/context-efficiency.md)
for the two charts, exact results, method, and limits.

Locally modified managed files are reported as conflicts. Interactive updates
ask before replacing them. Non-interactive updates exit unless you pass
`--force`, which backs up the conflicting files before replacement. Backups are
stored under `blueprint/.state/backups/` and ignored by git.

The first update of a legacy install creates the manifest. Files that already
match the current package are adopted automatically. Differing files remain
conflicts so local changes are not lost.

### If latest runs an older version

Check the version printed in the update plan before proceeding. A cached
package resolution can run an older release even when the command uses
`@latest`. Pin the intended published version explicitly. For example, for
1.12.0:

```bash
# npm
npx create-ai-blueprint@1.12.0 update

# pnpm
pnpm dlx create-ai-blueprint@1.12.0 update
```

Use the version from the [release list](https://github.com/aiblueprinthq/ai-blueprint/releases)
when following this example after a newer release. The interactive adapter
picker was introduced in 1.8.0. Run without adapter flags or `--yes` in an
interactive terminal to select adapters. If an older updater offers to replace
a newer global CLI with an older version, answer **No** and rerun the intended
version.

## Checking project status

Run the read-only status command from a Blueprint project or any directory
inside it:

```bash
npx create-ai-blueprint@latest status
```

It reports configuration state, recorded command activity, build-plan progress,
active work, findings, independent-review state, Git state, drift warnings,
completion blockers, and one
suggested next action. Onboarding uses a dedicated setup marker, overview
freshness uses a fingerprint of both plans that ignores checkbox completion
markers while still detecting plan content changes. A verified active-work
status makes the completion gate ready, while no active work reports the gate as
idle. Running command activity overrides
contradictory next-action advice, and an activity record that stops updating is
shown as interrupted instead of running forever. Malformed generated activity
points to `/doctor`, which can offer to reset only `blueprint/.state/run.json`
after approval. For scripts and integrations, request the versioned JSON object:

```bash
npx create-ai-blueprint@latest status --json
```

Tracked workflow skills use the packaged dashboard activity helper instead of
constructing `run.json` directly. The helper validates every field before an
atomic replacement. Invalid updates fail without replacing the previous valid
state, and the next tracked command safely replaces malformed legacy state.

After an interactive Blueprint install or update, the installer checks the
global CLI version. It offers to run the following command only when the CLI is
missing or does not match the npx package version:

```bash
npm install --global create-ai-blueprint@latest
```

The prompt defaults to no and is skipped for matching versions, non-interactive
runs, `--yes` runs, and runs from a source checkout of this repository.
Accepting it installs or refreshes the CLI at the same version used by the npx
command. Global installation exposes the shorter forms `blueprint status`,
`blueprint status --json`, and `blueprint dashboard`. Use `--target ./my-app` to
inspect an explicit project directory. Status never edits project or Git state.

### Command migration

Two standalone skills have been removed:

| Old command | Replacement |
| --- | --- |
| `/browser-tests` | `/tests browser` (Codex: `$tests browser`) |
| `/try` | `/check guide` (Codex: `$check guide`) |

Run the CLI update to install the consolidated skills. Updates remove unchanged
managed copies of the retired skills and report customized copies as conflicts,
preserving them until you resolve or explicitly replace them. Review old references in your preserved `AGENTS.md`; updates do not replace your
project instructions. The `qualityGates.regular.tryGuide` and
`qualityGates.continuous.tryGuide` keys keep their names and policies and now
select `/check guide`. No configuration migration is needed.

## Opening the local dashboard

Run the on-demand read-only dashboard from a Blueprint project or any directory
inside it:

```bash
blueprint dashboard
```

The command binds to `127.0.0.1` on an available port, opens the dashboard in
your browser, and refreshes immediately when project or Blueprint files change,
with a ten-second fallback check. It does
not edit project files, run workflow commands, start the application, or make
the dashboard available outside the local machine. It leads with the suggested
next action, then shows recorded command activity, active work and build steps,
the build-plan roadmap, project and Git state, findings, completion blockers,
and archived work. Autopilot and Continuous runs include their mode, progress,
configured gates, local boundary, and safe resume command when one is available.
Press Ctrl+C to stop it. Use `blueprint dashboard --no-open` when you want the
URL without opening a browser. The older `blueprint ui` form remains as a
deprecated alias.

The optional global `blueprint` command is limited to read-only project status
and this local dashboard. Continue to use `npx create-ai-blueprint@latest` for
installation and `npx create-ai-blueprint@latest update` for managed workflow
updates.

## Help and contributing

- Read the [full documentation](https://ai-blueprint.dev/docs/).
- Report reproducible problems through the repository's
  [issue forms](https://github.com/aiblueprinthq/ai-blueprint/issues/new/choose).
- Follow the repository's
  [security policy](https://github.com/aiblueprinthq/ai-blueprint/security/policy)
  for private vulnerability reports.
- Read the
  [contribution guide](https://github.com/aiblueprinthq/ai-blueprint/blob/main/CONTRIBUTING.md)
  before opening a pull request.

## License

MIT
