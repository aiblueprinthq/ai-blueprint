---
name: prototype
description: Plan and create throwaway static HTML and CSS mockups with shared design tokens before feature implementation. Use for /prototype, screen mockups, layout exploration, themes, or deciding a project's look and feel.
disable-model-invocation: true
---

# prototype - lock the look before you build

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

    plan  ->  /overview  ->  [prototype]  ->  /feature  ->  build
    (you      (project-      (lock the       (one spec    (real
     write)    overview.md)   look)           at a time)   code)

Prototyping is a pre-build step, not a feature. It's fast, visual, and throwaway.
Its one durable output is the theme: a set of CSS theme variables that port into
the real app's `globals.css` `@theme` when you build the first UI feature.
Everything else here gets discarded.

**This skill is plan-first.** Gather the look and the page list, agree on a plan,
and only then write any files. Never generate mockups before the user approves.

## Step 1 - read what the plan already says

Pull the stated look and feel and the screen/route list from
`blueprint/context/project-overview.md` (its UI/UX section); fall back to the UI/UX section
of `blueprint/project-plan.md` if the overview isn't generated yet. Use this
as the starting point, so you're refining the user's intent, not asking from
scratch.

## Step 2 - ask about the look and the pages

Work in plan mode. Ask the user a short set of questions (use the current tool's
short user-input prompt for discrete choices when available), seeded with what
the plan already says:

- **Look and feel** - confirm or adjust the vibe (light/dark, minimal/rich,
  density, editor-like, and so on), and ask for any reference apps or sites they
  want it to feel like.
- **Color and type** - any accent color or font direction (for example,
  mono-forward for code).
- **Which pages** - which screens to draft now. Default to the key routes from the
  plan; let the user add, drop, or reorder. Lean to a few, not every screen.

Keep it short. The user's answers, plus the plan, are the brief for the mockups.

## Step 3 - propose the plan, then wait

Present a short plan and stop for approval:

- the theme direction in a sentence or two (the vibe, accent, fonts), and
- the list of screens you'll mock, one line each on what each will show (the real
  states that exercise the theme, not empty shells).

Write nothing until the user approves. Adjust the plan if they push back.

## Step 4 - lock one theme

Once approved, write a single shared `prototypes/theme.css` that defines the theme
as CSS variables, following `reference/theme-variables.css`: surfaces, text,
accent, any component-specific states, font stacks, and a small scale. Derive the
values from the agreed brief.

This file is the deliverable. Keep it the single source of the theme, so tweaking
it restyles every mockup at once.

## Step 5 - mock each screen

For each approved screen, write a self-contained `prototypes/<screen>.html` that
links `theme.css` and lays out that screen with realistic dummy content and the
states that matter (a typing page mid-type with correct/wrong/pending chars and a
caret; a dashboard with believable stats and history rows; and so on).

- Plain HTML + CSS only. No framework, no build step. A few lines of inline JS for
  a view toggle is fine; nothing more.
- Pull every color, font, and spacing value from the `theme.css` variables, never
  hard-coded. That's what keeps the look consistent and portable.
- Realistic placeholder content over lorem ipsum. Desktop-first is enough.

## Then stop

Tell the user to open the files in a browser and iterate on the look. Point them
at the concrete next step: run `/feature` on the first UI feature - it detects
`prototypes/`, links these mockups as the spec's Design reference, and makes
porting `theme.css` into the app's `@theme` its first build step. When the theme
feels right the tokens carry into the real stylesheet; the HTML mockups are
reference and get discarded at that feature's `/complete`.

**Commit `prototypes/`, do not ignore it.** `theme.css` is the durable output and
until it is ported it lives nowhere else, and the mockups are the build reference
the next feature needs - both must survive a context clear or a switch between
machines. So do not add `prototypes/` to `.gitignore`; it is short-lived in git
(born here, discarded at the first UI feature's `/complete`), not throwaway that
never lands. This skill locks the look, it does not build the app.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
