---
name: complete
description: Wrap up a finished feature or fix. Archives its spec to blueprint/history/features/ (feature) or blueprint/history/fixes/ (fix), checks features off the build plan, resets blueprint/context/current-feature.md to its stub, makes one feature-level commit, then squash-merges the branch to main and deletes it. Merges only with explicit approval, then asks separately before pushing main. Use when the user runs /complete, or asks to finish, wrap up, merge, or close out the current feature or fix after it's built and reviewed.
---

# complete - log the finished work, make the feature commit, and merge

Where this sits in the workflow:

    /feature or /fix  ->  /implement  ->  [complete]  ->  next
    (the spec)            (build it)      (commit + merge + log)

`/implement` built the feature or fix on its branch, with optional per-step commit
checkpoints. This skill closes it out: it logs the work, makes the single
feature-level commit, and squash-merges. Run it only when the build is done,
reviewed, and the build and tests pass.

## Before you start

Confirm the work is actually finished: `blueprint/context/current-feature.md` holds a real
spec, its steps are built on a branch, and the build and tests pass. If any of the
spec's done-whens are behavioral, `/check` should have proven them against the
running app first - don't merge on an unverified claim. Uncommitted step work is
expected (per-step checkpoints are optional); this skill commits it. Don't require
the steps to be pre-committed.

## Step 1 - log the work

Check whether the spec is a feature or a fix (a fix is marked `Type: Fix` and has
no build-plan number).

- **Feature** - archive `blueprint/context/current-feature.md` to `blueprint/history/features/NN-name.md`
  (NN is the build-plan number), and check it off in `blueprint/build-plan.md`
  (and its parent item once all sub-items are checked).
- **Fix** - archive it to `blueprint/history/fixes/name.md`. A fix isn't a build-plan item, so
  there's nothing to check off.

Then reset `blueprint/context/current-feature.md` to its stub ("nothing in progress"). Don't
commit yet; the next step makes one feature commit covering the code and these doc
changes. The archive is the build history.

**Discard consumed prototypes.** If this feature built the look from `prototypes/`
- its Design reference pointed there and an early step ported `prototypes/theme.css`
into the app - delete the `prototypes/` folder now. The tokens live in the real
stylesheet and the HTML mockups were always throwaway; fold the deletion into this
feature's commit. Skip this if the feature didn't consume prototypes.

## Step 2 - make the feature commit

Stage everything on the branch (any uncommitted step work plus the Step 1 logging
changes) and make one conventional feature commit (for example `feat: <feature>`
or `fix: <name>`). Build and tests must pass first.

## Step 3 - merge

1. Squash-merge the branch into main, only with the user's explicit go-ahead, so
   the feature lands as one clean commit regardless of how many checkpoints the
   branch carried.
2. Delete the branch after a clean merge.
3. Stop and ask whether to push local `main` to its upstream. The merge approval
   does not count as push approval.
4. Push main only after a separate explicit yes to push main in the current chat.
   If the repo has no remote or upstream, say so instead of guessing.

Then point the user at `/feature` (or `/fix`) for the next thing.

Finish with a concise **How to try it** note for the completed feature. If the
manual path is more than a couple of steps, tell the user to run `/try latest`;
that command can read the archived feature after `current-feature.md` is reset.

## Pull request guardrails

If the project uses pull requests, make the PR description explain why the change
is needed, what scope was intended, what commands proved it, and where the
external review lives. Use `.github/pull_request_template.md` when present.

Before merge, strict CI may require `blueprint/reviews/current-diff-review.md` to
contain an external AI or human review of the current diff. Treat a placeholder
or missing review as a blocker, not a paperwork issue.

## Rules

- The feature is the unit of history: one squashed feature commit on main, even if
  the branch carried several checkpoint commits.
- Don't merge unfinished or failing work; the build and tests must pass first.
- Merging and pushing are the user's calls: get an explicit yes for the merge,
  then ask whether to push main. Do not treat merge approval, `/complete`, or
  "looks good" as permission to push.
- Push main only after a separate explicit yes to push main in the current chat.
- One item per completion. If a parent feature still has unchecked sub-features,
  leave the parent unchecked.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
