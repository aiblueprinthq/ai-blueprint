---
name: onboard
description: Set up the Blueprint after overlaying it onto a freshly scaffolded or early project. Detects the stack, tunes project files and adapters, documents real commands and existing checks, points to the optional standalone CI setup, and tells the user what to fill in before /overview or $overview. Use when the user runs /onboard, invokes $onboard, just copied the Blueprint into a new project, or asks what to do after overlaying the Blueprint. For an existing app with meaningful shipped features, use adopt instead.
---

# onboard - finish the Blueprint overlay setup

Where this sits in the workflow:

    scaffold app  ->  overlay Blueprint  ->  [onboard]  ->  project-plan + build-plan  ->  /overview
    (user/tool)       (copied files)          (tune setup)   (user-owned inputs)       (generated context)

`/onboard` is the fresh-project on-ramp. It assumes the app was scaffolded first
and the Blueprint files were overlaid after. Run it before filling in plans or
running `/overview`. Its job is to make the Blueprint fit the real project before
planning starts: commands, project title, conventions, ignore rules, and tool
adapters. It also asks whether the Blueprint workflow files should be committed
with the repo or kept local-only through `.gitignore`.

Use `/adopt` instead when the app is brownfield: real routes, shipped features,
and project behavior already exist and need to be reflected into the plans.

## Input

No argument is required. If the user provides context about the stack, hosting,
database, auth, or preferred tool, use it as a hint and verify against files.

## Step 0 - confirm this is onboarding, not adoption

Inspect the repository and the two planning docs:

- If `blueprint/project-plan.md` and `blueprint/build-plan.md` are mostly empty or
  worksheet-like, proceed.
- If the app already has substantial shipped features, stop and recommend
  `/adopt` instead.
- If the plans already contain real user-owned content, do not overwrite them.
  Continue only with setup files such as `AGENTS.md`, `coding-standards.md`,
  `.gitignore`, and optional notes.

Never run a framework scaffolder. The Blueprint is already overlaid.

## Step 1 - survey the project facts

Read only enough to identify the setup:

- package manager and lockfile (`pnpm-lock.yaml`, `package-lock.json`,
  `yarn.lock`, `bun.lockb`, etc.)
- manifest scripts (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, and
  similar)
- framework and runtime config (`astro.config.*`, `next.config.*`, `vite.config.*`,
  `tailwind.config.*`, database config, test config)
- source layout, route layout, and app/package directories
- existing `.gitignore`
- whether `.agents/` and `.claude/` are both needed
- whether Blueprint workflow paths are already tracked by git
- existing verification commands and `.github/workflows/`
- project name, from `package.json`, the folder name, existing docs, or the user

Do not infer more than the files support. Mark uncertain items as `> TODO` in the
summary rather than inventing a convention.

## Step 2 - update project entry files

If the root `README.md` is the copied Blueprint workflow document, move it out of
the product README slot:

- Detect it conservatively: the first heading is `# AI Coding Blueprint`, or the
  opening section clearly describes the Blueprint workflow rather than this app.
- Move that workflow document to `blueprint/README.md`.
- Do not overwrite an existing different `blueprint/README.md`; stop and report
  the conflict instead.
- Create a small root `README.md` stub for the actual project using the detected
  project name, one-line purpose when known, and the Commands from `AGENTS.md`.
  Keep it minimal if the project plan is not filled yet.
- Update any `AGENTS.md` pointer that says the root `README.md` explains the
  workflow so it points to `blueprint/README.md` instead.

If the root `README.md` already looks like a real project README, leave it alone.
Never replace a project README with Blueprint documentation.

Update the Commands section of `AGENTS.md` to match real scripts and commands.
Include only commands that exist or are intentionally available:

- dev server
- build
- preview or start
- lint, format, typecheck, and test, if configured
- verify, when a real combined verification command already exists
- useful app-specific commands, if obvious

If no test command exists, say so explicitly. Do not claim tests are a gate until
a real test command is configured.

If `CLAUDE.md` exists and still has the placeholder `# Project Name`, replace it
with the detected project name. Keep the `@AGENTS.md` and `@blueprint/...`
imports intact. Do not move detailed app context into `CLAUDE.md`; that belongs
in `AGENTS.md` and the generated project overview.

## Step 3 - tune coding standards

Update `blueprint/context/coding-standards.md` so it matches the detected stack.
Keep stable, tool-agnostic sections such as writing style, comments, scope, and
testing philosophy. Replace stack-specific defaults that do not apply.

Cover the practical conventions the build loop needs:

- framework and rendering model
- package manager
- project structure
- styling approach
- data access and API boundaries, if known
- validation and error handling expectations
- test gate status
- build and verification commands, via `AGENTS.md`

If the project is too new to reveal a convention, leave a concise `> TODO` rather
than pretending a pattern exists.

## Step 4 - check AI interaction rules

Read `blueprint/context/ai-interaction.md` and update only obvious mismatches.
Usually the default review loop should stay intact. Flag preferences for the user
instead of guessing, such as:

- whether commits should be offered after every step
- whether branches should use a different naming pattern
- whether `/check` should require browser evidence for UI work

If no changes are needed, say so.

## Step 5 - point to optional CI setup

Do not create or change Verify commands or GitHub workflows during onboarding.
Report any verification command or CI already present. When equivalent automatic
pull-request checks are absent, mention the optional standalone setup:

```text
Run /ci or $ci when you want automatic GitHub checks.
```

Explain that CI is not required to continue with planning or the Blueprint build
loop. The `/ci` skill owns project-specific Verify and GitHub workflow setup.

## Step 6 - check ignore files, visibility, and adapters

Update `.gitignore` for common generated files from the detected stack while
preserving existing entries. Typical examples include dependencies, build output,
framework caches, logs, environment files, test output, temporary files, and OS or
editor files.

Ask how Blueprint workflow files should be handled in git, unless the user
already gave a preference:

```text
Blueprint visibility?

1. Commit Blueprint workflow files
   Portable. Best for teams and working across machines.

2. Keep Blueprint workflow files local
   Adds .agents/, .claude/, blueprint/, and CLAUDE.md to .gitignore.
   Keeps AGENTS.md public as the lightweight project agent guide.
```

Recommend option 1 by default. If the user chooses option 2:

- Add this block to `.gitignore`, preserving existing entries:

  ```gitignore
  # AI Blueprint local workflow files
  .agents/
  .claude/
  blueprint/
  CLAUDE.md
  ```

- Keep `AGENTS.md` tracked. It remains the lightweight public project guide for
  commands and conventions.
- Make `AGENTS.md` public-safe: keep project description, commands, testing gate,
  and coding conventions, but remove or avoid Blueprint workflow explanations,
  hidden adapter paths, `blueprint/README.md` pointers, and core skill lists that
  would expose the local-only workflow.
- Explain that local-only mode hides the workflow contents from the repo, but the
  `.gitignore` names still reveal the ignored paths.
- Explain that Blueprint state, specs, findings, and history will not travel
  with the repo; another machine needs the Blueprint reinstalled or restored
  locally.
- If any of `.agents/`, `.claude/`, `blueprint/`, or
  `CLAUDE.md` are already tracked, say `.gitignore` will not hide tracked files.
  Ask before running
  `git rm --cached -r .agents .claude blueprint CLAUDE.md`, and
  only run it if the user explicitly approves. Never delete the local files.

Then report which adapter folders are needed:

- Codex only: keep `AGENTS.md`, `.agents/`, and `blueprint/`; `CLAUDE.md` and
  `.claude/` can be deleted.
- Claude Code only: keep `AGENTS.md`, `CLAUDE.md`, `.claude/`, and `blueprint/`;
  `.agents/` can be deleted.
- Mixed tools: keep both adapters.

Do not delete adapters unless the user explicitly asks.

## Step 7 - hand off to planning

Stop with a concise onboarding report:

- stack and package manager detected
- project name used for entry files
- README handling, especially if the copied Blueprint README was moved
- Blueprint visibility choice
- tracked-file warning if local-only mode was chosen after files were already tracked
- files changed
- commands now available
- testing gate status
- verification command and GitHub checks status
- adapter recommendation
- TODOs or uncertainties
- exact next files for the user to fill in:
  - `blueprint/project-plan.md`
  - `blueprint/build-plan.md`

Make the direct path clear: the user can write or develop those files through
any conversation, then run `/overview`. Also mention `/discovery` or `$discovery`
as an optional deep planning conversation for users who want guided help. Do not
start it, make it a prerequisite, or imply that directly written plans are less
complete.

End with the next command:

```text
/overview
```

For Codex, also mention:

```text
$overview
```

## Rules

- Setup files are fair game; planning docs are user-owned.
- `/discovery` is optional and never runs as part of onboarding. The direct
  plan-writing path must remain fully supported.
- Never overwrite real `project-plan.md` or `build-plan.md` content.
- Never run scaffolders or install dependencies unless the user explicitly asks.
- Reflect the stack that exists, not the stack the default Blueprint mentions.
- Be honest about tests. No `test` command means no required test gate yet.
- Keep `AGENTS.md` public in local-only mode unless the user explicitly asks for
  a more advanced setup.
- Do not untrack Blueprint files with `git rm --cached` without a separate
  explicit approval.
- Keep changes small and explain what changed.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
