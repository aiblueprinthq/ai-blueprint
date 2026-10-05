# Changelog

Notable changes to AI Blueprint are documented here. Release dates reflect the
published `create-ai-blueprint` package.

## [1.12.0] - 2026-10-05

### Added

- Added opt-in parallel work through isolated clones or Git worktrees, with one
  active work item per checkout and `git.landing: "pull-request"` for protected
  or shared repositories. Complete can now push the work branch and open a pull
  request while preserving separate approval for the final squash merge.
  Requested by [@draxx318](https://github.com/draxx318) in
  [#23](https://github.com/aiblueprinthq/ai-blueprint/issues/23).

### Fixed

- Stopped Status from treating an intentionally non-next active feature as
  drift when pull-request landing permits parallel feature branches. The serial
  ordering warning remains in the default local-merge workflow.

## [1.11.0] - 2026-10-05

### Added

- Added Google Antigravity as an official installer and updater adapter. It
  reuses `AGENTS.md` and `.agents/skills/`, supports interactive selection and
  the `--antigravity` flag, and does not add a separate skill tree. Requested by
  [@shadman2503](https://github.com/shadman2503) in
  [#27](https://github.com/aiblueprinthq/ai-blueprint/issues/27).

## [1.10.0] - 2026-09-24

### Added

- Added light and dark themes to the local dashboard, with a compact sun and
  moon toggle beside the Connected status. The dashboard follows the operating
  system theme until the user makes an explicit choice, then remembers that
  choice across Blueprint projects and available local ports for one year. The
  preference stays in the browser and never changes project files or Blueprint
  state, requested by [@karai17](https://github.com/karai17) in
  [#22](https://github.com/aiblueprinthq/ai-blueprint/issues/22).

## [1.9.0] - 2026-09-13

### Added

- Added `/explore` and `$explore` for read-only discussion grounded in the actual
  codebase. Compare options, including doing nothing, without requiring plans,
  writing files or activity state, or executing code. Brief remains the preview
  for an existing planned feature.

- Show command-specific CLI help for status, dashboard, and update. Mistaken
  AI skill invocations now explain the Codex and Claude Code chat commands, and
  unknown arguments point to the relevant help.

### Changed

- Reorganized the command guide around Feature, Implement, Check, Audit, and
  Complete, with a task picker and all 22 skills grouped by purpose. Clarified
  AI chat versus terminal commands, spec approval, verification versus manual
  guides and code review, and the two retired-command replacements. Existing
  gate defaults and permission boundaries remain unchanged.

- Consolidated manual walkthroughs into `/check guide`, including `latest` and
  scoped guides. Guide mode stays read-only and never runs checks or records
  acceptance; default `/check` retains behavioral verification. Removed the Try
  skill, with safe update conflicts for customized copies. Existing `tryGuide`
  configuration keys keep their behavior and now select Check's guide mode.

- Consolidated browser test setup into `/tests browser` and `$tests browser`.
  `/tests` defaults to unit setup, with `/tests unit` as an explicit form. Only
  the selected setup reference is loaded. Removed the standalone browser-tests
  skill; updates remove unchanged managed copies and flag customized copies as
  conflicts. Update old command references in preserved project instructions.

### Fixed

- Warn in `/doctor` when existing `AGENTS.md` lacks substantive
  proportional-engineering guidance. Explain that updates preserve this file,
  accept equivalent project wording, and give a manual repair that keeps
  existing rules and local-only visibility intact.

## [1.8.0] - 2026-09-12

### Added

- Added proportional-engineering guidance across planning, specification,
  implementation, automated workflows, and audit. New abstractions,
  dependencies, services, configuration, and specialized security machinery
  now require a current need, reducing unnecessary generated code and repeated
  context while preserving real trust and data-integrity boundaries,
  contributed by [@akash07k](https://github.com/akash07k).
- Let `npx create-ai-blueprint@latest update` change the installed adapters.
  Interactive updates show the adapter checkbox pre-filled with the installed
  set, adapter flags such as `update --codex` add an adapter without a prompt,
  and removed adapters follow the normal conflict and backup rules. Adding
  Claude Code creates `CLAUDE.md` only when it is missing, and removing it never
  deletes the file, requested by [@karai17](https://github.com/karai17).

### Fixed

- Made `npm run link:local` safely repeatable by replacing its existing global
  package registration before recreating the local link, contributed by
  [@akash07k](https://github.com/akash07k).
- Kept installers run from a linked source checkout from offering to replace the
  local commands with the registry package, contributed by
  [@akash07k](https://github.com/akash07k).

## [1.7.0] - 2026-09-11

### Added

- Offer an opt-in local pre-push hook at the end of `/ci`. The question defaults
  to no. When accepted, the hook runs the same Verify command before every push,
  `core.hooksPath` points at `.githooks`, JavaScript and TypeScript projects gain
  a `prepare` script that wires the hook after install, and the hook is run once
  before it is kept. `git push --no-verify` still bypasses it, so the GitHub
  ruleset remains the lock.

### Fixed

- Reject an installation target below a regular file before copying on every
  platform, instead of failing later with a raw filesystem error, contributed by
  [@akash07k](https://github.com/akash07k).
- Report history archive identifiers with forward slashes on Windows so status
  and the dashboard match repository paths, contributed by
  [@akash07k](https://github.com/akash07k).

### Changed

- Pinned the npm version used by the trusted publishing workflow and added a
  Windows CI job that runs the installer test suite alongside the Ubuntu Node 22
  and Node 24 matrix, contributed by
  [@akash07k](https://github.com/akash07k).

## [1.6.1] - 2026-09-08

### Fixed

- Validate installation destinations before copying files, rejecting symlinks
  and conflicting file paths without leaving a partial installation.
- Resume interrupted completion from the existing archive and Git state instead
  of repeating archival or starting the next feature prematurely.
- Preserve earlier feature archives and finding references when rebuilding a
  feature after rollback.
- Support independent review with intentionally local-only specs without
  forcing them into Git or requiring commits for review evidence alone.
- Keep failed verification and malformed review or findings evidence from
  appearing ready for completion in CLI status and the dashboard.

### Changed

- Simplified the build-plan template while keeping checkbox examples. Overview
  now formats clear feature lists into tracked checklists while preserving
  scope, order, existing IDs, and completion state. Changes to the plan's
  meaning still require approval.
- Clarified the no-AI-attribution rule for all tools, documented optional Claude
  Code settings, and identified obsolete Codex configuration advice. Existing
  tool configuration is preserved; no Git hooks or message rewriting are added.

## [1.6.0] - 2026-09-06

### Added

- Added automatic isolated independent review for sensitive or unusually broad
  work when the active adapter can prove fresh reviewer context, with a manual
  handoff fallback when it cannot.
- Added a sortable Findings table to the local dashboard with additive sorting
  by finding ID, priority, status, or description.

### Changed

- Defaulted independent-review selection to `when-sensitive` and review
  execution to `automatic` for new projects while preserving explicit project
  settings.
- Centered the active unchecked roadmap item, or the next planned item when no
  feature is active, while preserving manual scrolling during ordinary dashboard
  refreshes.
- Recorded requested and actual independent-review execution so completion can
  validate how fresh review evidence was produced.

### Fixed

- Recognized strict older `Current Feature` identity lines in active work and
  history while requiring new Feature, Fix, and Rollback specs to use canonical
  headings.
- Kept stale valid activity visible as interrupted and resumable without
  counting it as a project-health warning.

## [1.5.4] - 2026-09-04

### Added

- Added an optional read-only code walkthrough after the final Implement and
  Autopilot review packet, regardless of review cadence or checkpoint settings.

### Changed

- Clarified that Autopilot combines spec creation and implementation by
  continuing through the normal spec-approval stop.
- Distinguished local Verify evidence from authoritative clean-checkout proof
  produced by a successful GitHub Actions run.

### Fixed

- Prevented completed build-plan checkboxes from making the project overview
  appear stale while preserving drift detection for actual plan changes.
- Reported the completion gate as idle when no work is active and recognized
  older numbered feature fields in current work and history.

## [1.5.3] - 2026-09-03

### Changed

- Defaulted the interactive installer to Claude Code and Codex while leaving
  GitHub Copilot and OpenCode available but unchecked.

### Fixed

- Made Onboard preserve the installer-selected adapter list instead of treating
  every tool compatible with `.agents/` as selected.

## [1.5.2] - 2026-09-03

### Fixed

- Made Onboard create a reviewed scaffold-only first commit when needed, restore
  the setup branch, and continue without sending the user through manual Git
  recovery.
- Made Overview finalize the initial Blueprint baseline from either the default
  branch or its unchanged setup branch with one explicit local approval.

## [1.5.1] - 2026-09-02

### Fixed

- Added a packaged dashboard activity helper that validates state before an
  atomic replacement, preventing invalid command updates from corrupting
  `blueprint/.state/run.json`.
- Made Status route malformed activity to Doctor, where users can approve a
  narrow reset of only the generated dashboard record.

### Changed

- Clarified that Overview runs initially and after material plan changes, not
  before or after every feature.

## [1.5.0] - 2026-09-02

### Changed

- Changed Claude Code startup context to import only `AGENTS.md`; explicit
  skills now load the overview, active spec, coding standards, and interaction
  guide on demand.
- Tightened Feature around targeted reads, material decision stops, complete
  data and security contracts, safe rendering, runtime reachability, and one
  final spec write.
- Tightened Implement around the approved feature packet, targeted code reads,
  one final Verify run, and a separate rollback-only reference.
- Made Claude project skills explicit-only and taught the updater and Doctor to
  report obsolete direct context imports without editing user-owned
  `CLAUDE.md`. This covers the overview and active spec from 1.4.1 plus coding
  standards and the interaction guide from older layouts.
- Added adapter parity, explicit-invocation, update-cleanup, and on-demand
  context validation.

## [1.4.1] - 2026-09-01

### Changed

- Limited generated project overviews to less than 20,000 bytes, added a
  matching `/doctor` warning and `/feature` stop, and told Feature to reuse the
  overview already loaded by Claude Code instead of reading it twice.
- Replaced the original context benchmark and charts with a controlled Opus 5
  reproduction of the oversized-overview report and the compact correction.

## [1.4.0] - 2026-09-01

### Added

- Added `/doctor` context-size diagnostics for Claude imports and skill
  descriptions, plus a reproducible benchmark and two before-and-after charts.

### Changed

- Reduced Claude Code startup context by auto-importing only the core project
  instructions, overview, and active spec. Coding standards and interaction
  rules now load when relevant.
- Shortened all skill descriptions while preserving distinct routing terms and
  added a regression budget to prevent description bloat.
- Changed new-project defaults to one feature-level implementation review packet
  with step checkpoint commits disabled. Existing user-owned configuration is
  preserved during updates. Per-step approval remains available with
  `stepReview: "every"`; matching the previous checkpoint experience also
  requires `checkpointCommits: "enabled"`.
- Added Efficient, Guided, and Custom onboarding choices that write those two
  existing settings without introducing another persistent workflow mode.

## [1.3.0] - 2026-09-01

### Added

- Added a first-run `/overview` handoff that offers a reviewed local commit for
  Blueprint setup and planning before Feature 1, while skipping local-only
  installations and refusing to mix unrelated work into the baseline.

## [1.2.0] - 2026-08-31

### Added

- Added `/audit independent current` as a two-session review workflow with
  detected adapter and model selection, checkpoint-bound handoff records,
  durable reviewer receipts, staleness detection, completion blocking, and
  archived review evidence.
- Added `independentReview` policies to regular and Continuous quality gates,
  defaulting to `manual` alongside the existing gates.

## [1.1.0] - 2026-08-28

### Added

- Added the optional `/browser-tests` and `$browser-tests` setup skill for
  creating or normalizing a repository-owned browser harness that Feature,
  Implement, Check, and Continuous Mode can reuse.

## [1.0.1] - 2026-08-26

### Changed

- Reworked the npm package README to lead with Blueprint's product purpose and
  core feature loop, with specialized capabilities such as release readiness
  documented later.

## [1.0.0] - 2026-08-26

AI Blueprint 1.0 establishes the installer, shared workflow, project
configuration, and local status dashboard as the stable public baseline.

### Changed

- Redesigned the local dashboard around the next action, current work, roadmap,
  project state, findings, completion readiness, and completed history.
- Required `/rollback` to record full 40-character commit and parent SHA values
  for single-parent targets, and to stop before writing a spec when the target
  is a merge commit.
- Required `/implement` to validate both recorded SHAs, confirm a single parent,
  confirm the target is an ancestor of `HEAD`, and require a clean tree before
  reverse-applying a rollback patch.
- Stopped `/complete` from archiving or removing a `fixed` finding at any
  severity, so repaired findings remain in the ledger for a later `/audit`
  re-review.

### Added

- Added live command activity to the dashboard and status output, including the
  active command, mode, gates, progress, resume command, and recovery state.
- Added immediate dashboard refreshes when Blueprint or project files change.
- Added `npm run link:local` and `npm run unlink:local` for building, preparing,
  and globally linking the installer from a local checkout, so `create-ai-blueprint`
  and `blueprint` run from local files with no network access.

### Fixed

- Pinned the canonical `current-feature.md` and `findings.md` stubs so
  `/complete` can no longer reset them to paraphrased content.
- Fixed installer package root resolution so a source checkout finds its own
  `template/` directory. The documented local testing path failed because the
  installer looked one directory above the package.
- Reported the Blueprint config path as `blueprint/config.json` in warnings and
  status output on every platform, instead of leaking the Windows separator.

## [0.14.0] - 2026-08-25

### Added

- Added deterministic project configuration for review cadence, checkpoint
  commits, branch prefixes, verification strictness, regular and Continuous
  quality gates, and Continuous Mode limits.
- Added the explicit `/continuous` and `$continuous` workflow for completing
  remaining planned features serially with local branches, verification,
  archives, and one local main commit per feature without pushing.

### Fixed

- Made onboarding adapter choices name Codex, Claude Code, GitHub Copilot, and
  OpenCode accurately when recommending which shared skill trees to keep.

## [0.13.0] - 2026-08-23

### Added

- Added OpenCode support and a checkbox-based installer that can select multiple
  adapters. OpenCode reuses compatible skill files instead of installing a
  duplicate `.opencode/skills/` tree.
- Added a Blueprint visibility choice to `/adopt` so brownfield projects can
  commit workflow files or keep them local, contributed by
  [@sushantrahate](https://github.com/sushantrahate).

## [0.12.1] - 2026-08-21

### Fixed

- Kept optional CLI details subordinate to fresh-project onboarding and made
  `onboard` the final installation next step.
- Stopped installing the public repository README inside consumer projects and
  removed unchanged legacy copies during updates.

## [0.12.0] - 2026-08-21

### Changed

- Renamed the canonical live dashboard command to `blueprint dashboard` and
  kept `blueprint ui` as a deprecated compatibility alias.
- Clarified that the optional global `blueprint` CLI only provides shorter
  commands and that status and dashboard remain available through npx.

## [0.11.1] - 2026-08-21

### Changed

- Clarified dashboard health, Git, findings, connection, and active build-plan
  labels, balanced the top layout with a compact project and Git status stack,
  moved actionable state ahead of completed history, improved muted-text contrast
  and progress semantics, and removed the misleading initial progress animation.

## [0.11.0] - 2026-08-21

### Added

- Added `blueprint ui`, an on-demand read-only dashboard that binds to
  `127.0.0.1`, displays the build-plan roadmap, active work, completed history,
  findings, Git state, and next action, refreshes every second, and stops with
  the CLI process.
- Added the optional global CLI prompt to interactive Blueprint updates so
  existing users can install or refresh `blueprint ui` with the npx package
  version they just used. Matching installed versions skip the prompt.

## [0.10.0] - 2026-08-21

### Added

- Added GitHub Copilot support through the shared `AGENTS.md` and `.agents/skills/`
  adapter files.

### Changed

- Added `--all` as the default installer mode. Kept `--both` as a deprecated
  alias for `--all`.

## [0.9.1] - 2026-08-20

### Changed

- Limited the optional global `blueprint` command to read-only project status.
  Installation and updates remain under `npx create-ai-blueprint@latest`.

## [0.9.0] - 2026-08-20

### Added

- Added read-only `status` and `status --json` commands with project discovery,
  workflow progress, findings blockers, Git state, drift warnings, completion
  readiness, and deterministic next-action reporting.
- Added the `blueprint` installed binary as a shorter alias for the existing
  `create-ai-blueprint` package command.
- Added an opt-in post-install prompt for installing the exact package version
  globally so the shorter `blueprint` command is available.

## [0.8.0] - 2026-08-19

### Changed

- Migrated the installer, validation scripts, evaluations, and tests from
  JavaScript to strictly checked TypeScript with compiled ESM package output.
- Raised the supported Node.js version from 18 to 22 and added Node.js 22 and
  24 validation coverage.

## [0.7.0] - 2026-08-17

### Added

- Added repository licenses, security and support policies, issue forms, a pull
  request template, branded assets, and a custom social preview.
- Added generated GitHub Releases after successful tagged npm publications.
- Added deterministic routing evaluations for all Blueprint skills and
  opt-in live-agent scenarios for high-risk workflow boundaries.
- Added the read-only `/debug` and `$debug` workflow for reproducing failures,
  isolating root causes, and handing confirmed repairs to `/fix` or `/implement`.
- Added focused `quality`, `security`, `performance`, and `tests` lenses to
  `/audit` and `$audit`, independently selectable from the audit scope.
- Added the optional `/discovery` and `$discovery` workflow for developing
  detailed project plans through a deep, adaptive conversation, with full draft
  review and explicit approval before either user-owned plan is written.

### Changed

- Reworked the repository and npm README presentation around faster setup,
  clearer tool support, package badges, and contribution links.
- Expanded npm metadata and repository validation for the public trust surface.
- Added routing evaluations to the automatic repository gate while keeping all
  maintainer evaluation files out of the published package.
- Clarified that users may write plans directly or develop them through any AI
  conversation, and that `/discovery` never changes the existing manual path or
  becomes a prerequisite for `/overview`.

## [0.6.0] - 2026-07-26

### Added

- Added the explicit `/ci` and `$ci` workflow for defining one stack-aware
  Verify command and aligning GitHub verification with checks a project already
  has.

### Changed

- Updated onboarding, adoption, implementation, testing, completion, doctor,
  and autopilot guidance to reuse Verify without forcing CI or tests.
- Expanded repository validation to cover the new CI workflow and adapter
  contracts.

## [0.5.2] - 2026-07-23

### Added

- Added tag-triggered npm trusted publishing with package validation before
  release.

### Changed

- Surfaced the findings gate in the README introduction.

## [0.5.1] - 2026-07-23

### Added

- Added a live-agent end-to-end harness for the findings-ledger merge gate.

### Changed

- Required explicit risk acknowledgement before live-agent end-to-end runs.
- Tightened the canonical findings-ledger stub and invalidation evidence.

## [0.5.0] - 2026-07-22

### Added

- Added the durable findings ledger with stable IDs, severity, status, and
  resolution history.
- Made open or fixed P0 and P1 findings block `/complete` until they are closed,
  explicitly accepted, or invalidated with evidence.

## [0.4.0] - 2026-07-19

### Changed

- Moved installer state, backups, and manifest data from the project root to
  `blueprint/.state/`.
- Expanded package smoke tests to prove the new state path and the absence of
  the legacy root directory.

## [0.3.0] - 2026-07-19

### Added

- Added safe managed-file updates with conflict detection, dry runs, backups,
  and adapter-aware manifests.
- Added the reviewed rollback workflow for completed features.
- Added the repository validation gate and support for ongoing feature planning.

## [0.1.0] - 2026-07-07

### Added

- Published the initial `create-ai-blueprint` installer.
- Added Codex and Claude Code adapters for the file-backed planning, feature,
  implementation, checking, audit, and completion workflow.

[0.12.1]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.11.1...v0.12.0
[0.11.1]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/aiblueprinthq/ai-blueprint/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/aiblueprinthq/ai-blueprint/commits/v0.5.2
[0.5.1]: https://www.npmjs.com/package/create-ai-blueprint/v/0.5.1
[0.5.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.5.0
[0.4.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.4.0
[0.3.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.3.0
[0.1.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.1.0
