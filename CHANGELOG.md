# Changelog

Notable changes to AI Blueprint are documented here. Release dates reflect the
published `create-ai-blueprint` package.

## Unreleased

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
