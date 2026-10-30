---
name: adopt
description: Adopt Blueprint into an existing brownfield codebase by surveying shipped behavior and generating plans, standards, commands, adapter choices, and visibility setup. Use for /adopt or requests to bootstrap Blueprint into an established app. Use onboard for a fresh scaffold.
---

# adopt - bootstrap the blueprint from an existing codebase

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

    existing codebase  ->  [adopt]  ->  project-plan + build-plan + coding-standards  ->  /overview  ->  normal loop
    (already has code)     (survey +     (seeded from the real code; shipped               (project-       (/feature,
                            interview)     features already checked off)                    overview.md)     /implement, ...)

The standard onboarding assumes a freshly scaffolded, near-empty app: you write
the two plans from scratch and build forward. That doesn't fit a project that
already has thousands of lines of working code. `/adopt` is the brownfield
on-ramp: it reads what's already there, asks you only for what the code can't tell
it (the *why* and the *roadmap*), and produces the same input files the rest of
the workflow expects - so an existing project joins the loop without you
hand-writing everything.

It generates the inputs; it does not generate `project-overview.md`. That stays
`/overview`'s job. `/adopt` ends by telling you to run `/overview`.

## Input

A description of what the project is, if the user offers one. Otherwise just the
repository itself. No argument is required.

## Step 0 - confirm it's brownfield and safe

Look at `blueprint/project-plan.md` and `blueprint/build-plan.md`.

- If they're missing or still the empty worksheet/placeholder, proceed.
- If they already hold real content, this project is already adopted. Stop and say
  so; offer to refresh a specific file instead of overwriting work the user owns.

Never overwrite a filled-in plan without explicit confirmation. Never run a
framework scaffolder (the blueprint is an overlay, never a generator).

Protect the project README:

- If the root `README.md` already looks like a real project README, leave it
  alone.
- If the root `README.md` is the copied Blueprint workflow doc (for example it
  starts with `# AI Coding Blueprint`), report it as obsolete overlay content
  and ask before replacing or removing it. Do not move it into `blueprint/`.
- Do not create or overwrite a root project README for a brownfield app unless
  the user explicitly asks. The existing project face belongs to the app, not the
  workflow.

## Step 1 - survey the codebase (read-only)

Read the repo to establish the facts. Change nothing in this step. Establish:

- **Stack and tooling** - language(s), framework(s), and versions, from the real
  manifest (`package.json`, `requirements.txt`, `pyproject.toml`, `go.mod`,
  `Gemfile`, `Cargo.toml`, etc.). Note the package manager actually in use (lockfile).
- **Commands** - the real dev / build / test / lint scripts. These feed the
  Commands section of `AGENTS.md` and, per the testing opt-in switch, decide
  whether a testing gate even applies.
- **Conventions in practice** - directory layout, component/file naming, styling
  approach, state management, data-fetching pattern, error handling. Read what the
  code *does*, not what a default template prescribes.
- **Testing reality** - is a runner configured and are there tests, or none? Be
  honest; don't describe a gate the project doesn't have.
- **Verification and CI** - note any combined verification command, GitHub
  remote, `.github/workflows/`, or external CI. Preserve what already exists.
- **What the app already does** - the shipped features, inferred from routes,
  pages, entry points, and modules. This becomes the *checked* part of the build plan.

Keep notes; you'll turn them into the files in Step 3.

## Step 2 - interview for intent

The code reveals *what* and *how*, never *why* or *what next*. Ask the user a short
set of questions (aim for three to five, not an interrogation) to fill the gaps:

- What is this project for, and who uses it? (the problem and the users)
- Is the stack and structure you found intentional, or are there parts they'd call
  legacy / want to change?
- What do you want to build next? (the unchecked items in the build plan)
- Anything the survey got wrong or missed?

If the user already gave intent up front, skip what they've answered. Don't ask
what you can read from the code.

## Step 3 - generate the inputs

Write these, drawn from the survey (facts) and the interview (intent). Mark every
inference you're unsure of with a clear `> TODO (confirm)` so the user can correct
it rather than inherit a wrong guess.

- **`blueprint/project-plan.md`** - the what & why, following the existing
  worksheet structure (problem, users, features, data, tech, monetization, UI/UX).
  The "features" and "tech" sections describe what *already exists*; the rest comes
  from the interview.
- **`blueprint/build-plan.md`** - the ordered feature list as a checklist. **Mark
  shipped features `- [x]`** (this is the brownfield difference: the build plan
  reflects reality, so most of an existing app starts checked) and the roadmap
  items from the interview as `- [ ]`. This makes `/status` and `/feature` work
  immediately - the next unchecked item is genuinely what's next.
- **`blueprint/context/coding-standards.md`** - rewrite the default to match the
  project's *actual* conventions from Step 1, not the shipped Next.js/Prisma
  defaults. Keep the Writing and Comments sections; replace the stack-specific ones
  with what the code really does. Its Testing section must reflect the real testing
  state (the opt-in switch is a `test` command in `AGENTS.md`).
- **`AGENTS.md` Commands section** - fill in the real dev / build / test / lint
  commands you found, so the rest of the workflow (and the testing gate) uses the
  project's actual scripts. Include `Verify` when a real combined command exists.

Do not write `project-overview.md`; that's `/overview`'s job, downstream of these.

## Step 4 - point to optional CI setup

Do not create or change Verify commands or GitHub workflows during adoption.
Report any verification command or CI already present. When equivalent automatic
pull-request checks are absent, mention the optional standalone setup:

```text
Run /ci or $ci when you want automatic GitHub checks.
```

Explain that CI is not required to finish adoption. The `/ci` skill owns
project-specific Verify and GitHub workflow setup.

## Step 5 - ask about Blueprint visibility

Ask how the Blueprint workflow files should be handled in git, unless the user
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
  hidden adapter paths, workflow-document pointers, and core skill lists that
  would expose the local-only workflow.
- Explain that local-only mode hides the workflow contents from the repo, but the
  `.gitignore` names still reveal the ignored paths.
- Explain that Blueprint state, specs, findings, and history will not travel
  with the repo; another machine needs the Blueprint reinstalled or restored
  locally.
- Because adoption runs right after the Blueprint files were added to an
  existing repository, they are more likely to already be staged or committed
  than in a fresh install. If any of `.agents/`, `.claude/`, `blueprint/`, or
  `CLAUDE.md` are already tracked, say `.gitignore` will not hide tracked files.
  Ask before running
  `git rm --cached -r .agents .claude blueprint CLAUDE.md`, and
  only run it if the user explicitly approves. Never delete the local files.

## Step 6 - review gate, then hand off

Stop and show the user what you generated, calling out:

- the **build-plan split** - what you marked shipped vs not, since that's the
  judgment most worth their eyes,
- every `> TODO (confirm)` you left,
- anything the survey and the interview disagreed on,
- verification command and GitHub checks status,
- Blueprint visibility choice, and a tracked-file warning if local-only mode was
  chosen after files were already tracked.

These files are the ones the user *owns*. Have them review and adjust, then tell
them to run `/overview` to distill the plans into `project-overview.md` and start
the normal loop.

## Rules

- **Read-only until Step 3.** The survey changes nothing; only generation writes.
- **Reflect reality, don't prescribe.** `coding-standards.md` must match the code
  that exists. A project using Zustand and REST routes should not be handed
  standards about Server Actions and Prisma just because that's the default.
- Follow and preserve the proportional-engineering contract in `AGENTS.md`;
  record only established usage or trust constraints and leave unknowns blank.
- **Never invent intent.** Ask for the why and the roadmap; mark anything inferred
  with `> TODO (confirm)`. Silent guesses about purpose are the main failure mode.
- **Don't clobber owned work.** If the plans already have real content, confirm
  before touching them. Never run a scaffolder.
- **Be honest about testing.** If there's no runner, say testing is opt-in and not
  yet set up; don't describe a gate the project hasn't adopted.
- Keep `AGENTS.md` public in local-only mode unless the user explicitly asks for
  a more advanced setup.
- Do not untrack Blueprint files with `git rm --cached` without a separate
  explicit approval.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
