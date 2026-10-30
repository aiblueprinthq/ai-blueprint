---
name: release
description: Prepare local Render or Vercel deployment configuration and verify build, start, output, environment, and health-check readiness without deploying. Use for /release, Render setup, Vercel setup, deploy readiness, render.yaml, or vercel.json.
---

# release - deployment readiness for Render and Vercel

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` when `blueprint/.state/`
exists. From the project root, run the first helper that exists,
`node .agents/skills/doctor/scripts/run-state.mjs` or
`node .claude/skills/doctor/scripts/run-state.mjs`, with `start --command
<skill> --summary "<truthful summary>" --boundary
<read-only|reviewed|local-only>`. Use `update` at milestones, with `--status
blocked --resume <command>` for a blocker, and `finish --status ready|completed`
at the end; `--help` lists every option and `blueprint/workflow.md` has the full
activity contract. A missing or failing helper is a warning, not a blocker.

Where this sits in the workflow:

    /complete  ->  [release]  ->  deploy with explicit approval
    (feature       (config,       (human confirms
     finished)      checks)        external action)

`/release` is an optional deployment prep step. It gets the app ready to ship,
but it is not a deploy button. It can inspect, recommend, create local config
files, and run local checks. It must stop before any external provider action
unless the user gives an explicit yes in the current chat.

Initial targets:

- **Render** - static sites, web services, background workers, cron jobs, and
  `render.yaml` when useful.
- **Vercel** - frontend apps, full-stack framework apps, serverless functions,
  and `vercel.json` when useful.

## Input

Optional scope:

- no argument: inspect the project and recommend Render or Vercel if the target
  is obvious; otherwise ask which target to prepare
- `render`: prepare Render readiness and config
- `vercel`: prepare Vercel readiness and config
- `check`: read-only deployment readiness report
- `config`: focus on creating or updating local provider config files

If the user asks to deploy, connect a provider, create a remote service, set
remote env vars, push, publish, or run provider commands that affect a remote,
pause and ask for explicit confirmation before doing it.

## Step 1 - read the project

Read:

- `AGENTS.md`
- `blueprint/project-plan.md`
- `blueprint/build-plan.md`
- `blueprint/context/project-overview.md`
- `blueprint/context/current-feature.md`
- package or build files such as `package.json`, lockfiles, framework config,
  Dockerfile, `render.yaml`, `vercel.json`, `.env.example`, and README files
- git branch and working tree status

Identify:

- app type: static frontend, SSR app, API service, worker, CLI, monorepo, or
  hybrid
- build command, start command, dev command, test command, output directory, and
  package manager
- runtime needs: Node version, Python version, Docker, database, cache, object
  storage, queues, background jobs, cron, migrations, or file uploads
- env vars by name only; never print or write secret values
- health path or smoke test path

## Step 2 - choose the provider shape

For **Render**, decide whether the app should be:

- static site
- web service
- background worker
- cron job
- database paired with a service

For **Vercel**, decide whether the app should be:

- framework deployment with auto-detected settings
- static output deployment
- serverless or edge function app
- monorepo project with a root directory

If the provider is a poor fit, say that plainly and recommend the better target.
Examples: long-running workers usually fit Render better; a mostly frontend
Next.js or Astro site usually fits Vercel well.

## Step 3 - verify local readiness

Run only local, non-destructive checks that match `AGENTS.md`:

- install check only if dependencies are already present or the user approves an
  install
- build command
- test command when declared
- preview or start command if safe, then smoke test the health path
- lint or typecheck only when listed in project commands or package scripts

If a command is missing, report the gap instead of inventing certainty. If a
command needs secrets, list the env var names needed and skip that check.

## Step 4 - prepare local config

Only create or update local config files when the target is clear or the user
asked for config.

For **Render**, prefer `render.yaml` when the app needs repeatable setup or has
more than one service. Include:

- service type
- build command
- start command for web services
- static publish path for static sites
- health check path when known
- env var names without values
- region or plan only if the user specified it

For **Vercel**, create `vercel.json` only when the defaults are not enough.
Many Vercel projects need no config file. Include:

- build command only when it differs from defaults
- output directory only when needed
- rewrites or headers only when the app requires them
- install command only when the package manager cannot be inferred

For both providers:

- update `.env.example` with required names when useful
- add a short deployment note to README only if the project already has a
  deployment section or the user asks
- never write secret values

## Step 5 - report the release packet

Finish with a concise packet:

- **Target** - Render or Vercel, and why
- **Shape** - static site, web service, framework app, worker, or hybrid
- **Config changed** - files created or edited, or "none"
- **Checks run** - commands and result
- **Env needed** - names only
- **Smoke test** - exact path or command to verify after deploy
- **Blockers** - anything that must be fixed before shipping
- **Next action** - exact command or provider step, stopping before external
  action unless approved

## Rules

- Optional only. Do not add `/release` to the mandatory build loop.
- Do not deploy, create remote services, set remote env vars, push, publish, or
  transmit externally without explicit approval in the current chat.
- Do not write secret values to files or chat.
- Do not hide failing builds, missing env vars, or unknown output paths.
- Do not add provider config if the platform defaults are better.
- Keep the change small. Deployment setup should not become a full DevOps
  framework.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
