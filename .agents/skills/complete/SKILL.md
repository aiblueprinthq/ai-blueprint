---
name: complete
description: Wrap up a finished feature, fix, or rollback. Runs a final safety pass, archives its spec to blueprint/history/features/, blueprint/history/fixes/, or blueprint/history/rollbacks/, updates the build plan for features and rollbacks, resets blueprint/context/current-feature.md to its stub, makes one work-level commit, then squash-merges the branch to main and deletes it. Merges only with explicit approval, then asks separately before pushing main. Use when the user runs /complete, or asks to finish, wrap up, merge, or close out the current feature, fix, or rollback after it is built and reviewed.
---

# complete - log the finished work, make the work commit, and merge

Where this sits in the workflow:

    /feature, /fix, or /rollback  ->  /implement  ->  [complete]  ->  next
    (the spec)                         (build it)      (commit + merge + log)

`/implement` built the feature, fix, or rollback on its branch, with optional per-step commit
checkpoints. This skill closes it out: it logs the work, makes the single
work-level commit, and squash-merges. Run it only when the work is done,
reviewed, and the documented `Verify` command, or the fallback build and tests,
passes.

## Before you start

Confirm the work is actually finished: `blueprint/context/current-feature.md`
holds a real spec, its steps are built on a branch, and `Verify`, or the fallback
build and tests, passes. If any of the
spec's done-whens are behavioral, `/check` should have proven them against the
running app first - don't merge on an unverified claim. Uncommitted step work is
expected (per-step checkpoints are optional); this skill commits it. Don't require
the steps to be pre-committed.

## Step 0 - final safety pass

Before logging or committing, run a short safety pass and report blockers only:

- active spec exists and the work is not being completed from `main` or `master`
- changed files are tied to the active spec, with no unrelated dirty work mixed
  in (a dirty `blueprint/context/findings.md` is expected, since `/audit` writes it)
- the exact `Verify` command from `AGENTS.md` passed in this session, when one is
  declared; otherwise the build passed, and tests passed when the project has a
  declared test command and the change touched logic
- behavioral done-whens have `/check` evidence or equivalent proof, and there is
  a clear manual try path
- if workflow files changed, `.agents` and `.claude` stayed in sync where both
  adapters exist
- no P0 or P1 finding in `blueprint/context/findings.md` is `open` or `fixed`.
  `fixed` still blocks on purpose: the repair exists but no review has looked at
  it - run `/audit` to close it. The only waivers are `accepted` (the user's
  explicit decision in the current chat, reason recorded; never set it for
  them) or `invalid` (an `/audit` re-examination verdict with recorded
  evidence, or the user's explicit call). A missing ledger file means no
  findings.

Do not claim "passed", "verified", or "working" without naming the command,
route, screenshot, or output that proves it. Stop before Step 1 if required
evidence is missing.

## Step 1 - log the work

Check whether the spec is a feature, fix, or rollback. A fix is marked
`Type: Fix` and has no build-plan number. A rollback is marked `Type: Rollback`
and records the exact target feature, archive, commit, and parent.

- **Feature** - archive `blueprint/context/current-feature.md` to `blueprint/history/features/NN-name.md`
  (NN is the build-plan number), and check it off in `blueprint/build-plan.md`
  (and its parent item once all sub-items are checked).
- **Fix** - archive it to `blueprint/history/fixes/name.md`. A fix isn't a build-plan item, so
  there's nothing to check off.
- **Rollback** - archive it to
  `blueprint/history/rollbacks/YYYY-MM-DD-NN-name.md`, preserving the original
  completed feature archive. Create `blueprint/history/rollbacks/` first if an
  older Blueprint installation does not have it yet. Uncheck the exact target item in
  `blueprint/build-plan.md` and its parent when applicable, then append a concise
  note to the target line with the rollback date and archive path. Keep the
  feature number stable. If the user later decides the feature is permanently
  abandoned rather than pending rebuild, that roadmap decision is a separate
  plan edit.

**Archive resolved findings.** If `blueprint/context/findings.md` holds any
findings, append a `## Findings` section to the archive file just written with
every `closed`, `accepted`, or `invalid` entry at its final status (`accepted`
entries keep their recorded reason). Prefix each ID with the archive name for
global uniqueness: feature 12's `F-03` becomes `12/F-03`; fixes and rollbacks
use their archive filename as the prefix. An entry carried forward from earlier
work archives with the item that resolved it; its **Found** line preserves
where it came from. Then remove the archived entries from the ledger. Unresolved entries (`open` or `fixed` P2/P3, and `unverified`
leads) stay in the ledger with their IDs so they are never silently dropped.
When nothing remains, reset the ledger to exactly this stub, and create it the
same way if the file is missing (an older install):

    # Findings

    > **Generated file.** The findings ledger: review findings raised by `/audit`
    > against the work in progress, each with a durable ID, severity (P0-P3), and
    > status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
    > moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
    > finding is `open` or `fixed`, then archives resolved findings with the work
    > and resets this file.

    _No findings recorded. `/audit` appends findings here when it finds them._

After archiving resolved findings, replace both context files with the canonical
stubs below. Do not paraphrase either file, retain closed findings, or substitute
an abbreviated "no work" stub. Before committing, read both files and confirm
they exactly match these contents:

    # Current Feature

    > **Generated file.** Holds the one feature, fix, or rollback being built right now. Run
    > `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
    > an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
    > Build one thing at a time; `/complete` archives it under
    > `blueprint/history/` and resets this file.

    _Nothing in progress. Run `/feature`, `/fix`, or `/rollback` to start._

    # Findings

    > **Generated file.** The findings ledger: review findings raised by `/audit`
    > against the work in progress, each with a durable ID, severity (P0-P3), and
    > status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
    > moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
    > finding is `open` or `fixed`, then archives resolved findings with the work
    > and resets this file.

    _No findings recorded. `/audit` appends findings here when it finds them._

Do not commit yet; the next step makes one work commit covering the code and
these documentation changes. The archive is the build history.

**Discard consumed prototypes.** If this feature built the look from `prototypes/`
- its Design reference pointed there and an early step ported `prototypes/theme.css`
into the app - delete the `prototypes/` folder now. The tokens live in the real
stylesheet and the HTML mockups were always throwaway; fold the deletion into this
feature's commit. Skip this if the feature didn't consume prototypes.

## Step 2 - make the work commit

Stage everything on the branch (any uncommitted step work plus the Step 1 logging
changes) and make one conventional work commit (for example `feat: <feature>`,
`fix: <name>`, or `revert: roll back <feature>`). `Verify`, or the fallback build
and tests, must pass first.

## Step 3 - merge

1. Squash-merge the branch into main, only with the user's explicit go-ahead, so
   the feature lands as one clean commit regardless of how many checkpoints the
   branch carried.
2. Delete the branch after a clean merge.
3. Stop and ask whether to push local `main` to its upstream. The merge approval
   does not count as push approval.
4. Push main only after a separate explicit yes to push main in the current chat.
   If the repo has no remote or upstream, say so instead of guessing.

Then point the user at `/feature`, `/fix`, or `/rollback` for the next thing.

Finish with a concise **How to try it** note for the completed work. For a
rollback, explain how to confirm the removed behavior is gone and name one
unaffected regression path. If the
manual path is more than a couple of steps, tell the user to run `/try latest`;
that command can read the archived feature after `current-feature.md` is reset.

## Rules

- The work item is the unit of history: one squashed feature, fix, or rollback
  commit on main, even if the branch carried several checkpoint commits.
- A rollback preserves the original feature archive and adds a separate rollback
  archive. Never rewrite history to make the feature look as if it never existed.
- Don't merge unfinished or failing work. The documented `Verify` command, or
  the fallback build and tests, must pass first.
- Never merge while a P0 or P1 finding is `open` or `fixed` in the ledger. The
  recorded ways past the gate without code are `accepted` (only by the user's
  explicit decision, with their reason) or `invalid` (only from re-examination
  evidence or the user's explicit call); both travel into the archive, never a
  silent drop.
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
