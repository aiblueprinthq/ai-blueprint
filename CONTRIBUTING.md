# Contributing

AI Blueprint ships workflow files and a dependency-free Node.js installer. The
repository validation gate requires Node.js 22 or newer and an `npm ci` install
for the TypeScript maintainer toolchain.

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
2. Run `npm ci`.
3. Make the smallest change that solves the documented problem.
4. Keep matching Codex and Claude Code skill files synchronized.
5. Update user-facing documentation when behavior changes.
6. Run `npm run check`.
7. Open a pull request using the repository template.

## Validation commands

| Command | Purpose |
| --- | --- |
| `npm run check` | Run the complete repository gate used by CI, including skill routing evaluations. |
| `npm run check:static` | Check adapter parity, command inventories, imports, references, and package metadata. |
| `npm test` | Run the installer unit tests. |
| `npm run test:routing` | Run deterministic skill selection cases without invoking an AI agent. |
| `npm run test:sandbox` | Run deterministic tests for the inspectable scaffold runner. |
| `npm run test:link-local` | Verify that local linking can safely replace its existing global registration. |
| `npm run test:package` | Pack the npm artifact and smoke-test individual, combined, default, and legacy adapter installs. |
| `npm run sandbox` | Scaffold a minimal app, run the local packed Blueprint through its real prompts, verify it, and start its server. |
| `npm run sandbox:clear` | List every saved sandbox run, ask for confirmation, then delete those runs. |
| `npm run sandbox:demo` | Run the interactive sandbox with example project and build plans ready for workflow testing. |
| `npm run link:local` | Build this checkout, prepare its template, and replace the global `create-ai-blueprint` and `blueprint` commands with links to the local files. |
| `npm run unlink:local` | Remove the global link created by `npm run link:local`. |
| `E2E_ACCEPT_RISK=1 npm run test:e2e` | Run all live-agent behavior scenarios in scratch repositories. |

Run `npm run check` before opening or merging a pull request. The package smoke
test builds the installer template, packs it into a temporary directory, installs
that artifact locally, verifies every supported adapter mode, and removes its temporary
files.

## Running the installer from a local checkout

`npx create-ai-blueprint` always fetches the published package. To install from
your own checkout instead, including a fork with local modifications, link it
once:

```bash
npm run link:local
```

That builds the installer, prepares its template, and links the `create-ai-blueprint`
and `blueprint` commands globally. They then run entirely from local files, with no
network access:

```bash
create-ai-blueprint --target ../my-app
blueprint status
```

Re-run `npm run link:local` after editing the source. The linked commands run the
compiled `dist/` output and a copied `template/`, not the source files directly, so
edits are not picked up until both are rebuilt. Re-running the command removes the
existing global package registration before recreating the link, so a separate
`npm run unlink:local` is not required. Installer runs from the linked checkout
also skip the optional prompt that would replace the local commands with the
registry package.

`npm run unlink:local` runs `npm rm --global create-ai-blueprint`, which removes any
global copy of the package, whether it was linked from a checkout or installed from
the registry.

## Inspectable scaffold sandbox

`npm run sandbox` automates the maintainer's real manual acceptance path. It
creates a dependency-free Node app under `.sandbox/`, creates the initial Git
commit, packs the current local Blueprint, installs that artifact through `npx`,
then runs the app's test and build scripts. The Blueprint installer stays
interactive by default so maintainers see
the same adapter and optional global CLI prompts as a normal user. Internal pack,
Git, config, and file-list details stay hidden.

After Blueprint installation and verification pass, the command starts the
minimal app's development server for live review. Press Ctrl+C to stop the server
and finish the command.

The completed app is preserved by default, and the final output prints its
absolute path. It also adds `npm run blueprint:status` and `npm run
blueprint:dashboard` inside that app. Those commands are pinned to the tarball
packed from the current branch, so an older global npm release cannot be
mistaken for the code under review. `npm run sandbox:demo` replaces the starter
placeholders with a small task-tracker project and three ordered features,
ready for `/overview`, `/feature`, Autopilot, or Continuous Mode. Other options
support a named run or a fixed adapter choice:

```bash
npm run sandbox -- --name manual-proof
npm run sandbox:demo
npm run sandbox -- --adapter all --no-server --clean
```

This command is intentionally separate from `npm run check` and CI because its
default installer flow is interactive. `--clean` removes the sandbox only after
a successful run and after the server stops. Use `--adapter` and `--no-server`
together for unattended proof. Failed runs are preserved for diagnosis.

Clear all preserved sandbox runs with:

```bash
npm run sandbox:clear
```

The command lists the exact folders and asks before permanently deleting them.
Use `npm run sandbox:clear -- --yes` only when confirmation must be skipped.

## Workflow changes

Shared skills under `.agents/skills/` and `.claude/skills/` must remain identical.
Add or remove a command in both adapter trees, the `blueprint/workflow.md`
command inventory, the `AGENTS.md` skills list, and the README command table in
the same change. Keep `AGENTS.md` to the project contract that every session
needs; workflow reference belongs in `blueprint/workflow.md`. The validation gate rejects any
drift between those surfaces.

The root `package.json`, `scripts/`, `.github/`, and this guide are maintainer
files. They are not copied into applications by `create-ai-blueprint`.

## Skill evaluations

Routing cases live under `evals/routing/`, with one JSON file per skill. Each
case includes realistic prompts that should select the skill and prompts owned by
another skill that must not select it. These deterministic checks run during
`npm run check` and in GitHub CI.

Live-agent scenarios under `scripts/e2e/scenarios/` test observable workflow
boundaries such as stopping after a feature spec, keeping `/check` read-only,
diagnosing through `/debug` without edits, blocking completion on open findings,
keeping focused audit lenses inside their requested concern, and stopping
Autopilot before a merge.
They spend tokens and allow an agent to edit an isolated scratch repository, so
they never run in CI and require the explicit `E2E_ACCEPT_RISK=1` opt-in. Run one
scenario by name when changing a specific skill:

```bash
E2E_ACCEPT_RISK=1 npm run test:e2e -- feature-gate
E2E_ACCEPT_RISK=1 npm run test:e2e -- audit-lenses
E2E_ACCEPT_RISK=1 npm run test:e2e -- discovery-optional
```

The routing cases, evaluator, and live-agent scenarios are maintainer-only. The
package smoke test confirms they are absent from the published npm artifact.

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
