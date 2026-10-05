---
name: fix
description: Write a current-feature.md spec for an ad-hoc bug fix or small unplanned change, then stop before implementation. Use for /fix, confirmed bugs, or small changes that do not belong in the build plan.
---

# fix - document an ad-hoc fix, then build it like anything else

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    /fix  ->  /implement  ->  /complete  ->  back to your features
    (spec     (build it,      (log to blueprint/history/fixes/
     the fix)  reviewed)       + merge)

A fix is a bug or small change that isn't a planned build-plan feature. It runs
through the same loop as a feature (build with review gates, iterate, then merge);
it just starts here instead of `/feature`, and is logged separately.

## Input

A description of the bug or change, for example `/fix "password reset email never
sends"`. If the user just reported the problem in chat, use that.

The input may also be a finding ID from `blueprint/context/findings.md`, alone
or with a description, for example `/fix F-03`. Pull the problem statement from
that ledger entry. Use this form only between work items, when
`current-feature.md` is the reset stub: this skill overwrites that file, so
while a spec is active, repair its findings through `/implement` instead.
Never replace another worker's active spec. Parallel work uses one clone or Git
worktree per work item, with a separate branch in each checkout.

## Step 1 - write the fix spec

Pull context from `blueprint/context/project-overview.md` and `blueprint/context/coding-standards.md`,
then write a short spec to `blueprint/context/current-feature.md` (this file holds whatever
is being built now, feature or fix). Its first heading must be exactly
`# Fix: <title>`, and it must retain the `**Type:** Fix` contract below. Keep it
lighter than a feature spec:

- **Title** - the bug or change in a few words.
- **Type:** Fix  (so `/complete` logs it to `blueprint/history/fixes/`, not `blueprint/history/features/`).
- **Status:** not started - `/implement` updates this durable workflow state as
  work and verification progress.
- **Branch:** the full fix branch from the configured prefix plus the fix title
  in lowercase kebab-case.
- **Fixes:** `<finding id>` - only when the fix targets a ledger finding. The
  stamp makes the repair traceable: `/implement` marks that finding `fixed`
  when the repairing step lands, and `/audit` re-reviews it before it closes.
- **The problem** - what's wrong or what needs to change, and where.
- **The fix** - the root-cause repair, and anything it must not break. Do not add
  an abstraction, dependency, service, configuration surface, compatibility
  layer, or security mechanism unless the defect is in that layer or an
  established repository requirement needs it now. Adding a missing
  authorization, ownership, validation, escaping, or redaction check is a
  root-cause repair, not new machinery.
- **Build steps** - usually one small step; split only if the diff would be too
  big to read. Each ends with an observable "done when".
- **Verify** - how to confirm it's fixed (what to click or test).

Then stop. Tell the user to review the fix spec, then run `/implement` to build it.

## Rules

- A fix is not a build-plan item; don't add it to `build-plan.md`.
- Keep it small. If it's really a new feature, use `/feature` and the build plan
  instead.
- Same conventions as everything else (`blueprint/context/coding-standards.md`).

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
