---
name: implement
description: Build the feature or fix spec'd in blueprint/context/current-feature.md, one small reviewable step at a time. Creates the branch, implements each step, shows the diff and explains it in plain English, tests, and iterates until it works. After each approved step it offers an optional commit checkpoint on the branch; the feature-level commit, merge, and logging are /complete's job. Use when the user runs /implement, or asks to build, implement, or start the current feature or fix once its spec is ready.
---

# implement - build the current feature or fix, one reviewed step at a time

Where this sits in the workflow:

    /feature or /fix  ->  [implement]  ->  /complete  ->  next
    (the spec)            (build it,       (commit +
                           reviewed)        merge + log)

`/feature` (or `/fix`) wrote the spec to `blueprint/context/current-feature.md` and stopped.
This skill turns that spec into code, following the build loop in
`blueprint/context/ai-interaction.md`, without vibe coding: small steps, a visible diff plus
a plain-English explanation for each, testing, and iteration until it works, all
behind your approval. It builds on a branch and offers an optional commit
checkpoint after each step; the feature-level commit, merging, and logging are
`/complete`'s job.

## Before you start

Read `blueprint/context/current-feature.md`. If it has no real spec (still the stub, or its
status is already complete), stop and tell the user to run `/feature` (for a
planned feature) or `/fix` (for an ad-hoc bug or change) first. Pull the
conventions from `blueprint/context/coding-standards.md` and the data model from
`blueprint/context/project-overview.md` so the code matches them.

If the spec's Design reference points at `prototypes/*.html`, those mockups are
the visual target - build components to match them, and treat `prototypes/theme.css`
as the token source (the spec's first step ports it into the app's global
stylesheet before the components are built).

**Resuming?** If the spec already has some build steps checked off (`- [x]`), this
feature was started earlier and interrupted (often a cleared context). The spec and
its ticked steps are files, so pick up where it left off: read which steps are done,
check the git branch and `git status`/log to see what is committed and what is still
in the working tree, then continue from the **first unchecked step** instead of
starting over. No separate save/load is needed - the project instructions load
`current-feature.md` every session.

## Step 1 - branch

Create and check out a branch named from the spec: `feature/<name>` for a feature,
`fix/<name>` for a fix. If the project isn't a git repo yet, say so and ask the
user to run `git init` first; the loop needs branches. On resume, the branch
already exists - check it out instead of creating a new one.

## Step 2 - build one step, review, iterate, checkpoint

Work through the spec's build steps in order, one at a time. For each step:

1. Implement just that step: the smallest change that satisfies its "done when."
2. Show the **diff**, not whole files.
3. **Explain it, and prove it.** Give a short summary: what the step delivered,
   one line per changed file on what it does and why, then confirm the step's
   "done when" is met with evidence (build output, a screenshot, a passing
   assertion). This summary is the comprehension gate, so keep it concrete, not
   ceremonial. Include a short **How to try it** note when the step has a manual
   path: the command, URL, click, endpoint, or output the user can check.
4. **Build, and test if the project tests.** Run the project's build command (see
   Commands in `AGENTS.md`). If the project declares a `test` command in
   `AGENTS.md` (the opt-in switch), run it: a step that adds logic must ship a
   passing test in the same diff, and the suite
   must be green before the step is approved (see the Testing gate in
   `coding-standards.md`); UI and integration-only steps ride on screenshot plus
   build evidence. For UI or integration done-whens, prefer Playwright when it is
   already installed or declared in `AGENTS.md`; do not add it silently for an
   unrelated feature. Create focused test files next to the source they cover, per
   `coding-standards.md`. Never install a runner mid-step unless the current spec
   is explicitly the unit-testing setup itself (for example `/fix "add unit
   testing"`). If a step surfaces non-trivial logic the spec didn't foresee, add a
   focused test then, or note why not. When a step's done-when is behavioral (a
   click, a download, a flow across screens), run `/check` to prove it against the
   running app rather than eyeballing it.
5. **Run guardrails for risky diffs.** If the step touches source, workflow,
   planning, or review files, run
   `pwsh scripts/guardrails/Invoke-BlueprintGuardrails.ps1 -Mode ci` when the
   script exists. Treat failures as real blockers. Warnings about external review
   mean the PR will need another AI or human review artifact before strict CI
   passes.
6. **Iterate until it works.** If it fails or the user wants changes, revise the
   step (re-prompt or hand-edit the code), show the updated diff, and re-test.
   Repeat until it works and the user approves. Nothing is committed until the
   user is happy with the step.
7. **Mark it done, then prompt to move on.** Once the step is approved, check that
   step off (`- [x]`) in `blueprint/context/current-feature.md` so progress survives a context
   clear. Then offer a short choice, noting that checkpoints are optional since
   `/complete` makes the real feature-level commit. Use the current tool's short
   user-input prompt when available; when you've just produced a long block to
   read (a deep explanation, a big
   walk-through), ask in plain text instead, so the prompt doesn't cover what the
   user is still reading:
   - **Continue** (default) - roll into the next step without committing.
   - **Commit checkpoint** - commit just this step on the branch with a
     conventional message (a cheap rollback point).
   - **Walk me through it** - give a deeper, line-level explanation of the new or
     changed code (why this approach, what each part does, any gotchas), then
     re-ask this checkpoint prompt. A loop-back, not a terminal choice.
   - **Stop here** - pause the loop so the user can review or come back later.

   On **Continue** or after **Commit checkpoint**, go to the next step. On **Walk
   me through it**, explain in depth and then re-ask this prompt in plain text (the
   explanation is long, so a modal would cover it). On **Stop here**, stop and say
   where things stand: the branch is intact; run `/implement` again to resume, or
   `/complete` to wrap up what's built so far.

Never batch the whole thing into one diff. If a step's diff is too big to read,
split it. Build and tests must pass before any commit.

## Step 3 - hand off to /complete

When every step is built and the build and tests pass (committed as checkpoints or
not), stop. Tell the user it's done on its branch and to run `/complete`, which
makes the one feature-level commit, logs it (archive, check off if it's a feature,
reset), and merges. Include a short **How to try it** section, or tell the user
to run `/try` for the full manual walkthrough. This skill does not touch main.

## Rules

- One small step per diff; the user reviews and approves each before any commit.
- Explain every change in plain English. Understanding the code is the point.
- Iterate on the branch until each step works; never commit code the user hasn't
  approved.
- Follow `blueprint/context/coding-standards.md` (server vs client, scope user-owned queries
  by the authenticated user id, validate inputs, and so on).
- Build only what the spec says. If the spec is wrong or thin, stop and fix the
  spec first, do not improvise.
- Per-step commits are optional checkpoints. The feature-level commit, the merge,
  and any push are `/complete`'s job.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
