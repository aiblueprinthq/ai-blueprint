<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/mark-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/mark-light.svg">
    <img src="assets/mark-light.svg" alt="AI Blueprint" width="64" height="64">
  </picture>
</p>

<h1 align="center">AI Blueprint</h1>

<p align="center"><strong>A file-backed, spec-driven AI coding workflow framework for building real software while staying in control.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-ai-blueprint"><img src="https://img.shields.io/npm/v/create-ai-blueprint?style=flat-square&color=155eef" alt="npm version"></a>
  <a href="https://github.com/aiblueprinthq/ai-blueprint/actions/workflows/validate.yml"><img src="https://github.com/aiblueprinthq/ai-blueprint/actions/workflows/validate.yml/badge.svg" alt="Validate Blueprint"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/aiblueprinthq/ai-blueprint?style=flat-square&color=155eef" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://ai-blueprint.dev">Official site</a> |
  <a href="https://ai-blueprint.dev/docs/">Documentation</a> |
  <a href="https://www.youtube.com/watch?v=L4g6GGLzAyo">Video demo</a> |
  <a href="https://www.npmjs.com/package/create-ai-blueprint">npm</a> |
  <a href="https://github.com/aiblueprinthq/ai-blueprint/releases">Releases</a> |
  <a href="CHANGELOG.md">Changelog</a>
</p>

AI Blueprint gives coding agents a shared workflow framework for planning,
building, verifying, and documenting one feature at a time. Plans, specs,
findings, review evidence, and completed history stay as readable files in your
project instead of disappearing with the chat that created them.

It works with any application stack. Supported adapters include Codex, Claude
Code, and GitHub Copilot. Google Antigravity and OpenCode are supported too.
Other file-aware coding agents can follow the readable workflow files. AI
Blueprint does not replace your application framework or add application code.

Start with the scaffold-first [Quick Start](#quick-start) below.

## Why use it?

AI coding gets unreliable when product intent lives only in chat, several
features blur together, and claims such as "working" or "tested" are not backed
by observable evidence.

Blueprint adds a controlled loop:

- **Spec before code.** The agent writes a feature or fix spec and stops for
  review before implementation.
- **Proportional engineering.** Plans and builds require a current need before
  adding abstractions, dependencies, services, configuration, or specialized
  security machinery. Unknown scale defaults to the smaller reversible design,
  while real trust and data-integrity boundaries still apply.
- **Explain the result.** Every completed implementation offers a read-only code
  walkthrough, regardless of the configured review cadence.
- **One work item at a time.** The current feature, fix, or rollback has one
  explicit scope and one set of acceptance criteria.
- **Proof before completion.** Check runs the real app against the spec instead
  of treating a green build as behavioral proof.
- **Findings with teeth.** Audit records durable findings, and unresolved P0 or
  P1 findings block completion.
- **Independent review when it matters.** A fresh reviewer session can inspect
  an exact checkpoint and leave a staleness-checked receipt.
- **Human approval at external boundaries.** Commit, merge, push, deployment,
  publication, and destructive actions keep their approval gates.

The point is not to remove judgment. It is to preserve it while AI helps write
the code.

## Quick start

AI Blueprint adds an AI coding workflow framework around your project. It is
not an application starter and does not replace your application framework.
Scaffold the app first and initialize Git before installing it.

**Requirements:** Node.js 22 or newer, an existing application, and a Git
repository.

First create the application manually or with the scaffolding CLI for your
framework or language of choice. This example uses Next.js, but Blueprint works
with any stack. From the root of the new application, initialize Git if the
scaffolder did not, then install Blueprint:

```bash
npx create-next-app@latest my-app
cd my-app
git init
```

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


Next:

1. Run `onboard` so Blueprint learns the real stack, commands, conventions,
   adapter setup, and workflow visibility you want.
2. Write `blueprint/project-plan.md` and `blueprint/build-plan.md` directly, or
   use the optional discovery skill to develop them through conversation.
   A plain feature list is enough for the build plan.
3. Run `overview` to format that list into a tracked checklist without changing
   its scope or order, then generate durable project context. Formatting needs
   no extra approval; unclear scope or order does. On the first run, it offers a
   reviewed local commit for the Blueprint setup and plans.
4. Run `feature` for the next planned item, review the generated spec, and then
   begin implementation.

Run the `npx` commands above in your terminal. Run workflow skills such as
`onboard` in your AI coding chat, using the invocation style for your tool:

| Tool | Example |
| --- | --- |
| Codex | `$onboard`, `$overview`, `$feature` |
| Claude Code | `/onboard`, `/overview`, `/feature` |
| GitHub Copilot | Ask Copilot to run the matching skill |
| Google Antigravity | `/onboard`, `/overview`, `/feature` |
| OpenCode | Ask OpenCode to run the matching skill |

The interactive installer lets you select one or more adapters. It adds the
workflow files needed by those tools and leaves your application's `README.md`
alone.

See [Commit and PR attribution](blueprint/context/ai-interaction.md#commit-and-pr-attribution)
for the rule for all AI tools and optional settings that reduce unwanted AI signatures.

See [Getting Started](https://ai-blueprint.dev/docs/getting-started/) for the
complete installation and onboarding walkthrough. For a project that already
has shipped features, start with
[Adopting an Existing Codebase](https://ai-blueprint.dev/docs/existing-codebase/).

## The workflow

Learn these five commands first:

```text
/feature -> /implement -> /check -> /audit current -> /complete
```

![AI Blueprint fresh-project workflow](assets/ai-blueprint-workflow.svg)

Each step has a narrow job:

1. **Feature** selects one build-plan item and writes its buildable spec. Review
   and approve that spec before implementation.
2. **Implement** builds the approved spec in small, visible steps.
3. **Check** proves the acceptance criteria against the running application.
4. **Audit** reviews the complete branch delta and records actionable findings.
5. **Complete** runs the final gates, archives the work, and asks before the
   configured local merge or pull-request landing.

This is a teaching path, not a new gate policy. Audit, Check, and manual-guide
gates still default to `manual`; independent review defaults to `when-sensitive`.
Run the checks and reviews your project requires. Showing Audit here does not
make it mandatory for every feature.

The optional `/explore <topic>` weighs an idea against the actual code before
planning work. It compares options, including doing nothing, without writing files or
requiring plans. Use `/brief` to explain an existing planned feature instead.

Other work enters the same control loop:

- Use `fix` for a small unplanned change or confirmed bug.
- Use `debug` first when the cause is unclear.
- Use `rollback` to reverse a completed feature without erasing its history.
- Use `check guide` when you want a human manual-review guide.

Read [Core Workflow](https://ai-blueprint.dev/docs/core-workflow/) for the full
lifecycle and command-specific behavior.

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

## Live dashboard

See your roadmap, current work, findings, and next action in one local browser
view. The dashboard refreshes as Blueprint files and Git state change, keeping
build steps, command activity, review gates, and completed history visible
alongside your project's progress.

![Angled AI Blueprint dashboard preview showing Article Reach project health, roadmap progress, and Git state](assets/blueprint-dashboard-angled.png)

Run it from your Blueprint project:

```bash
npx create-ai-blueprint@latest dashboard
```

With the optional global CLI installed, use `blueprint dashboard` instead.
The dashboard opens in your browser, binds to `127.0.0.1`, and stops when you
press `Ctrl+C`. It is read-only and does not start your application or run
workflow commands.

Read [Local Dashboard](https://ai-blueprint.dev/docs/cli/dashboard/) for the
full tour and command options.

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

All 22 skills are installed for each selected adapter. These groups help you
find a command; they do not add installation modes or configuration. Examples
use Claude Code slash commands in AI chat. Codex uses the matching `$skill` form,
and other adapters can run the named skill through plain language.

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

See the [Command Guide](https://ai-blueprint.dev/docs/command-guide/) for the
full reference. Terminal commands manage installation, updates, status, and the
dashboard; they do not run these skills. For example, `blueprint doctor` explains
how to invoke Doctor in chat. Use `npx create-ai-blueprint@latest status --help`
for focused terminal help.

## File-backed project state

Two files remain the planning inputs you own:

| File | Purpose |
| --- | --- |
| `blueprint/project-plan.md` | Product direction, users, features, data, stack, business model, and UX decisions |
| `blueprint/build-plan.md` | Ordered, high-level feature list with stable item numbers |

Blueprint turns those inputs into project state that any installed adapter can
read:

| File | Purpose |
| --- | --- |
| `blueprint/context/project-overview.md` | Durable project context generated from both plans |
| `blueprint/context/current-feature.md` | The active feature, fix, or rollback spec |
| `blueprint/context/findings.md` | Audit findings with durable IDs, severities, and statuses |
| `blueprint/context/review.md` | Independent-review handoff and latest reviewer receipt |
| `blueprint/history/` | Archived feature, fix, and rollback records |
| `blueprint/config.json` | User-owned workflow policy shared by every adapter |

This state stays tool-independent. A project can move between supported agents
without moving its plan and history back into chat.

Read [Writing Your Plans](https://ai-blueprint.dev/docs/writing-your-plans/) and
the [File Reference](https://ai-blueprint.dev/docs/file-reference/) for the
detailed contracts.

## Review and verification

Blueprint separates several kinds of proof that are easy to blur together:

- **Verify command:** project-owned type checks, tests, builds, or other
  repeatable checks.
- **Check:** observable proof that the current work satisfies its spec.
- **Audit:** branch-aware review across quality, security, performance, and
  tests, with focused lenses when needed.
- **Independent Audit:** a fresh reviewer session or configured isolated
  reviewer child inspects an approved checkpoint using an exact adapter and model.
- **Check guide:** `/check guide` generates a read-only manual walkthrough for human review.

Independent review records the target, permitted base, spec hash, requested and
actual reviewer metadata, Check result, commands, evidence, findings, and
remaining risk. Relevant later changes make the receipt stale. Adapter, model,
and fresh-context identity remain declared metadata, not cryptographic proof.

Independent review defaults to `when-sensitive` for regular and Continuous
work. Audit, check, and try guide default to `manual`. Sensitive or unusually
broad work therefore receives independent review automatically, while ordinary
small features do not. Set a workflow's independent review policy to `manual`
to disable automatic selection. An explicit `/audit independent current` is
still available and uses the configured execution method. Configuration never
grants permission to merge, push, deploy, publish, or waive findings.

The gate decides when independent review is required. The separate
`review.independentExecution` setting decides how it runs and defaults to
`automatic`, which starts an isolated reviewer when the active adapter can prove
fresh context and exact reviewer metadata. Unsupported automatic execution stops
with the manual handoff instead of skipping review. Set execution to `manual` to
always prepare the fresh-session handoff.
The automatic reviewer is a generic child of the current runtime, instructed
only by the installed project's Audit skill and review contract. No global agent
role, skill, prompt, or TraversyFlow installation is required or discovered.
New requests bind the selected execution mode and receipts bind what actually
ran. This prevents an unbound subagent claim from satisfying the gate while
preserving older fresh-session receipts.

Read [Code Quality](https://ai-blueprint.dev/docs/code-quality/),
[Audit](https://ai-blueprint.dev/docs/commands/audit/), and
[Project Configuration](https://ai-blueprint.dev/docs/project-configuration/)
for the complete rules.

## Automatic GitHub checks

Automatic checks are an explicit setup step, not part of installation or
onboarding. Run `ci` when you want Blueprint to define one project-specific
Verify command from checks the repository already has and create or align a
matching GitHub workflow.

**Verify is the recipe.** CI runs that same recipe automatically on pull
requests and default-branch pushes. Blueprint does not invent a test runner,
coverage target, browser suite, security scan, or version matrix just to fill
the workflow.

At the end, `ci` offers an optional local pre-push hook that runs the same
Verify command before each push. The offer defaults to no, and
`git push --no-verify` bypasses the hook, so a GitHub ruleset remains the lock.

Read [CI Setup](https://ai-blueprint.dev/docs/commands/ci/) for the full contract.

## Optional automation

The conservative workflow remains the default. Two explicit modes can automate
bounded local work while preserving safety boundaries and configured quality
gates:

- **Autopilot** combines spec creation and implementation for one feature or fix,
  continues through the normal spec-approval stop, and then runs its configured
  regular gates before stopping prior to completion.
- **Continuous Mode** processes reviewed build-plan items serially with one
  local branch and one local main commit per completed feature.

Neither mode pushes, deploys, publishes, sends messages, performs destructive
actions, waives findings, or makes uncovered product decisions.

Read [Autopilot](https://ai-blueprint.dev/docs/commands/autopilot/) and
[Continuous Mode](https://ai-blueprint.dev/docs/commands/continuous/) before
using them.

## Tool support

| Tool | Installed adapter | Invocation |
| --- | --- | --- |
| Codex | `.agents/skills/` | `$feature`, `$implement`, or plain language |
| Claude Code | `.claude/skills/` | `/feature`, `/implement`, and other slash commands |
| GitHub Copilot | `AGENTS.md` and `.agents/skills/` | Ask Copilot to run the matching skill |
| Google Antigravity | `AGENTS.md` and `.agents/skills/` | `/feature`, `/implement`, and other slash commands |
| OpenCode | `AGENTS.md` and compatible shared skills | Ask OpenCode to run the matching skill |
| Other tools | `AGENTS.md` plus readable skill files | Ask the agent to follow the matching `SKILL.md` |

Codex and GitHub Copilot share `.agents/skills/`, and Google Antigravity uses
that tree too. Claude Code uses `.claude/skills/`. OpenCode can reuse either
compatible tree, so the installer does not create duplicate skill copies.

Read [Tool Adapters](https://ai-blueprint.dev/docs/tool-adapters/) for selection,
invocation, and project-layout details.

## Status and updates

Check a Blueprint project without changing it:

```bash
npx create-ai-blueprint@latest status
```

Preview and apply managed workflow updates:

```bash
# npm
npx create-ai-blueprint@latest update --dry-run

# pnpm
pnpm dlx create-ai-blueprint@latest update --dry-run

# npm
npx create-ai-blueprint@latest update

# pnpm
pnpm dlx create-ai-blueprint@latest update
```

Update can also add an adapter to an existing installation:

```bash
npx create-ai-blueprint@latest update -- --codex
```

An optional global installation exposes the shorter `blueprint` command:

```bash
npm install --global create-ai-blueprint@latest
blueprint status
```

Read [Updating Blueprint](https://ai-blueprint.dev/docs/updating-blueprint/) and
[CLI Status](https://ai-blueprint.dev/docs/cli/status/) for details.

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

## Documentation

- [Getting Started](https://ai-blueprint.dev/docs/getting-started/)
- [Core Workflow](https://ai-blueprint.dev/docs/core-workflow/)
- [Command Guide](https://ai-blueprint.dev/docs/command-guide/)
- [Project Configuration](https://ai-blueprint.dev/docs/project-configuration/)
- [Testing](https://ai-blueprint.dev/docs/testing/)
- [Manual Review](https://ai-blueprint.dev/docs/manual-review/)
- [Local-Only Mode](https://ai-blueprint.dev/docs/local-only-mode/)
- [Troubleshooting](https://ai-blueprint.dev/docs/troubleshooting/)

## Support and contributing

- Follow [SUPPORT.md](SUPPORT.md) for usage questions and reproducible bugs.
- Follow [SECURITY.md](SECURITY.md) to report vulnerabilities privately.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.
- Review [CHANGELOG.md](CHANGELOG.md) for published package history.

## License

AI Blueprint is available under the [MIT License](LICENSE).
