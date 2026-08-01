# Contributing

AI Blueprint ships workflow files and a dependency-free Node.js installer. The
repository validation gate requires Node.js 18 or newer and does not require an
install step.

## Before you start

- Search existing issues before opening a new one.
- Use the bug, feature, or question issue form so reports include enough context.
- Report suspected vulnerabilities privately through the process in
  [SECURITY.md](SECURITY.md).
- Keep changes focused. Large workflow additions should start with an issue so
  the behavior and cross-tool impact can be agreed on before implementation.

Bug fixes, workflow improvements, documentation corrections, installer safety
work, and additional verification are welcome. App-specific features and large
framework abstractions do not belong in this repository.

## Development workflow

1. Fork the repository or create a dedicated branch.
2. Make the smallest change that solves the documented problem.
3. Keep matching Codex and Claude Code skill files synchronized.
4. Update user-facing documentation when behavior changes.
5. Run `npm run check`.
6. Open a pull request using the repository template.

## Validation commands

| Command | Purpose |
| --- | --- |
| `npm run check` | Run the complete repository gate used by CI. |
| `npm run check:static` | Check adapter parity, command inventories, imports, references, and package metadata. |
| `npm test` | Run the installer unit tests. |
| `npm run test:package` | Pack the npm artifact and smoke-test Codex, Claude, and combined installs. |

Run `npm run check` before opening or merging a pull request. The package smoke
test builds the installer template, packs it into a temporary directory, installs
that artifact locally, verifies all three adapter modes, and removes its temporary
files.

## Workflow changes

Shared skills under `.agents/skills/` and `.claude/skills/` must remain identical.
Add or remove a command in both adapter trees, the `AGENTS.md` command inventory,
and the README command table in the same change. The validation gate rejects any
drift between those surfaces.

The root `package.json`, `scripts/`, `.github/`, and this guide are maintainer
files. They are not copied into applications by `create-ai-blueprint`.

## Pull requests

Pull requests should explain the problem, the chosen behavior, and the evidence
that the change works. Screenshots are useful for documentation or visual
changes, but command output and state assertions are better proof for installer
and workflow behavior.

Maintainers may ask for a smaller scope, stronger verification, or clearer
documentation before merging. Passing CI is required but does not replace code
review.

By contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE) and that you will follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
