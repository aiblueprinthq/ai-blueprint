---
name: brief
description: Brief an upcoming build-plan feature without writing files. Explain scope, dependencies, affected areas, size, and likely splits for the next item or a named item. Use for /brief, feature previews, what comes next, or build-order decisions before /feature.
---

# brief - understand a feature before you spec it

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Where this sits in the workflow:

    build-plan + overview  ->  [brief]  ->  /feature  ->  /implement
    (what exists)              (read-only    (spec it)     (build it)
                                explainer)

This skill answers one question: *what does this feature actually involve, before
I commit to spec'ing it?* It reads the two files that describe the work and prints
a short briefing so you can decide whether to spec it now, reorder it, split it,
or clear a blocker first. It is the read-only precursor to `/feature`.

It never writes anything: no spec, no edits to `build-plan.md`, no branch, no
commit. `/feature` is the mutating step that turns a briefing into a spec; this
one just explains.

How it differs from its neighbors:

- `/explore` investigates an open idea against the code without requiring plans.
  `/brief` explains an existing build-plan item.

- `/blueprint-status` reports the *whole project*: progress, current work, git, next action.
  `/brief` zooms into *one feature* and explains it in depth.
- `/feature` *writes* the spec (and may split the item in `build-plan.md`).
  `/brief` previews what `/feature` would tackle, changing nothing.

## Input

A feature from `build-plan.md`, by number or name - e.g. `/brief 4` or
`/brief "validator"`.

**With no argument, brief the next one** - the first unchecked leaf in
`build-plan.md`, the same target `/feature` would pick.

If `build-plan.md` is still a placeholder stub or the overview is missing, say so
plainly and point at `/overview` (or filling the plans) rather than inventing a
briefing.

## What it reads

Gather these, then synthesize. Don't dump file contents; explain.

1. **The target** - the feature's line in `blueprint/build-plan.md`, plus whether
   a parent was already split into sub-items (`4a`, `4b`, ...).
2. **Full context** - `blueprint/context/project-overview.md`: the data model,
   routes/endpoints, stack, UI/UX, conventions, and open questions that touch this
   feature.
3. **What already exists** - earlier checked build-plan items and, if useful, git
   history, to ground the dependency read (what must be in place first, what this
   unblocks later).
4. **Design reference** - if `prototypes/` exists and the feature is UI-facing,
   note which mockups apply (that `/feature` will link them and port `theme.css`).

## Output

A short, scannable briefing, not a wall of text. Aim for something like:

    Feature 5 - Submission draft flow
    What: maintainers submit a skill by GitHub URL (primary) or zip (fallback);
      drafts are saved before validation runs.
    Depends on: apps/api must be stood up first (this is the first feature that
      needs the backend); builds on the Skill / SkillVersion shapes from feature 3.
    Unblocks: queue-backed validation (6) and the publishable flow (7).
    Touches: new User, Submission, SkillVersion tables (Drizzle); GitHub OAuth;
      POST /submissions; R2 snapshot upload; a React upload island (client).
    Size: large - likely splits into 5a (OAuth + maintainer profile), 5b
      (GitHub-URL submission + draft record), 5c (zip upload + R2).
    Reference: no prototype for this flow; upload.html covers the later validation
      panel, not this form.
    Open questions: apps/api (Hono) is not scaffolded yet - resolve before spec'ing.

    Next: run /feature 5 to spec 5a, or clear the apps/api blocker first.

Adapt the lines to the feature; drop any that don't apply. Always end with a
single **Next** action - usually `/feature N` to spec it, but `/overview` if the
plans aren't ready, `/prototype` if it's UI-facing and the look isn't locked, or
"clear X first" when a dependency blocks it.

## Rules

- **Read-only, always.** Never write a file, never edit `build-plan.md` or
  `current-feature.md`, never branch, commit, install, or build. To act on the
  briefing, the user runs `/feature` next.
- **Explain, don't spec.** Size, dependencies, and a likely sub-split are the
  value here; the actual build steps are `/feature`'s job. Don't write step lists.
- **Trace to the plans.** Everything in the briefing comes from `build-plan.md`
  and `project-overview.md`. Don't invent scope; if something is underspecified,
  say so and flag it as a question for `/feature` or `/overview`.
- **Be honest about gaps.** If the plans are a stub, the overview is stale, or a
  dependency isn't built yet, say that plainly - catching a blocker before
  spec'ing is half the value.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
