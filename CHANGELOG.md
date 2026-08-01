# Changelog

Notable changes to AI Blueprint are documented here. Release dates reflect the
published `create-ai-blueprint` package.

## Unreleased

### Added

- Added repository licenses, security and support policies, issue forms, a pull
  request template, branded assets, and a custom social preview.
- Added generated GitHub Releases after successful tagged npm publications.

### Changed

- Reworked the repository and npm README presentation around faster setup,
  clearer tool support, package badges, and contribution links.
- Expanded npm metadata and repository validation for the public trust surface.

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

[0.6.0]: https://github.com/bradtraversy/ai-blueprint/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/bradtraversy/ai-blueprint/commits/v0.5.2
[0.5.1]: https://www.npmjs.com/package/create-ai-blueprint/v/0.5.1
[0.5.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.5.0
[0.4.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.4.0
[0.3.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.3.0
[0.1.0]: https://www.npmjs.com/package/create-ai-blueprint/v/0.1.0
