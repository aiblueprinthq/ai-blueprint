# create-ai-blueprint

Install AI Blueprint into an already scaffolded app.

[![npm version](https://img.shields.io/npm/v/create-ai-blueprint?style=flat-square&color=155eef)](https://www.npmjs.com/package/create-ai-blueprint)
[![Validate Blueprint](https://github.com/bradtraversy/ai-blueprint/actions/workflows/validate.yml/badge.svg)](https://github.com/bradtraversy/ai-blueprint/actions/workflows/validate.yml)
[![MIT license](https://img.shields.io/npm/l/create-ai-blueprint?style=flat-square&color=155eef)](LICENSE)

[Official site](https://ai-blueprint.dev) |
[Documentation](https://ai-blueprint.dev/docs/) |
[Repository](https://github.com/bradtraversy/ai-blueprint) |
[Changelog](https://github.com/bradtraversy/ai-blueprint/blob/main/CHANGELOG.md)

Requires Node.js 18 or newer. Run the installer from an application that has
already been scaffolded and initialized as a Git repository.

```bash
npx create-ai-blueprint@latest
```

You can also use npm's initializer form:

```bash
npm create ai-blueprint@latest
```

The installer copies the Blueprint workflow files into the current directory:

- `AGENTS.md`
- `CLAUDE.md`
- `blueprint/.state/manifest.json`
- `.agents/`
- `.claude/`
- `blueprint/`

It keeps the app's root `README.md` alone and installs the Blueprint workflow
docs at `blueprint/README.md`.

The installed workflow includes optional Render and Vercel deployment readiness
through `/release` or `$release`; it prepares local config and checks, but does
not deploy without explicit approval.

The optional `/ci` or `$ci` skill sets up automatic GitHub checks separately
from onboarding and adoption. It detects the real project commands, defines one
Verify command from checks that already exist, and adds a matching pull request
workflow without replacing existing CI. It does not invent tests or add git
hooks, coverage, browser tests, security scans, or version matrices by default.

It also includes `/rollback` or `$rollback` for planning a reviewed reversal of
a completed feature from its archived spec and exact git commit. Rollbacks keep
the original feature archive and use the normal implement, check, and complete
gates.

If you install the Blueprint while Claude Code is already open in the project,
restart Claude Code in that folder so the newly added project skills appear.

## Tool support

| Tool | Installed adapter | Invocation |
| --- | --- | --- |
| Codex | `.agents/skills/` | `$feature`, `$implement`, or plain language |
| Claude Code | `.claude/skills/` | `/feature`, `/implement`, and other slash commands |
| Other tools | `AGENTS.md` plus readable skill files | Ask the agent to follow the matching `SKILL.md` |

## Options

```bash
npx create-ai-blueprint@latest -- --codex
npx create-ai-blueprint@latest -- --claude
npx create-ai-blueprint@latest -- --both
npx create-ai-blueprint@latest -- --force
npx create-ai-blueprint@latest -- --target ./my-app
```

The same flags work with `npm create ai-blueprint@latest -- ...`.

Use `--force` to overwrite existing Blueprint files. Without `--force`, the
installer asks before overwriting in an interactive terminal and exits in
non-interactive runs.

## Updating an existing installation

Preview the update plan:

```bash
npx create-ai-blueprint@latest update --dry-run
```

Apply the update:

```bash
npx create-ai-blueprint@latest update
```

The updater detects the installed adapters and manages only these paths:

- `.agents/skills/`
- `.claude/skills/`
- `blueprint/README.md`

It preserves `AGENTS.md`, `CLAUDE.md`, project and build plans, context, history,
references, and prototypes. The `blueprint/.state/manifest.json` file records the
installed version and hashes of managed files.

Locally modified managed files are reported as conflicts. Interactive updates
ask before replacing them. Non-interactive updates exit unless you pass
`--force`, which backs up the conflicting files before replacement. Backups are
stored under `blueprint/.state/backups/` and ignored by git.

The first update of a legacy install creates the manifest. Files that already
match the current package are adopted automatically. Differing files remain
conflicts so local changes are not lost.

## Help and contributing

- Read the [full documentation](https://ai-blueprint.dev/docs/).
- Report reproducible problems through the repository's
  [issue forms](https://github.com/bradtraversy/ai-blueprint/issues/new/choose).
- Follow the repository's
  [security policy](https://github.com/bradtraversy/ai-blueprint/security/policy)
  for private vulnerability reports.
- Read the
  [contribution guide](https://github.com/bradtraversy/ai-blueprint/blob/main/CONTRIBUTING.md)
  before opening a pull request.

## License

MIT
