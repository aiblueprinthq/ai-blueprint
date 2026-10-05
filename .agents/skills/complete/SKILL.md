---
name: complete
description: Complete a finished feature, fix, or rollback by running final gates, archiving its spec, updating plans, creating the work commit, and requesting approval to land it locally or by pull request. Use for /complete or requests to finish, wrap up, merge, or close the current work item.
---

# complete - log the finished work, make the work commit, and land it

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    /feature, /fix, or /rollback  ->  /implement  ->  [complete]  ->  next
    (the spec)                         (build it)      (commit + land + log)

`/implement` built the feature, fix, or rollback on its branch, with optional per-step commit
checkpoints. This skill closes it out: it logs the work, makes the single
work-level commit, then follows `git.landing`. The default `local-merge` path
squash-merges locally. The optional `pull-request` path pushes the work branch
and opens a pull request for a later squash merge. Run it only when the work is
done, reviewed, and the documented `Verify` command, or the fallback build and
tests, passes.

## Before you start

Read `blueprint/config.json`. A missing file means the built-in defaults apply.
If the file exists but is invalid, stop and point the user to `/doctor`.
Configuration can strengthen or shape the completion gates, but it never grants
permission to commit, merge, push, deploy, publish, or take destructive action.
Record `git.landing`; a missing value defaults to `local-merge`. The
`pull-request` value applies only to this skill. Continuous Mode remains a
local-only serial workflow and never pushes or opens pull requests.

Before requiring a real active spec, check for pending completion using
`reference/completion-recovery.md`. A matching archive may mean archival was
interrupted, the work commit awaits merge, or the merge already finished. Follow
that phase instead of restarting logging. Missing or ambiguous evidence stops
with concrete recovery steps; a reset stub never authorizes selecting new work.
Recovery uses archive and Git proof, never dashboard activity as authority.

For a normal completion with no recovery in progress, continue below.

Confirm the work is actually finished: `blueprint/context/current-feature.md`
holds a real spec, its steps are built on a branch, and `Verify`, or the fallback
build and tests, passes. Apply the configured regular quality gates below before
logging or committing. Uncommitted step work is expected because per-step
checkpoints are optional; this skill commits it. Don't require the steps to be
pre-committed.

Read `blueprint/context/review.md` when present. A missing file on an older
install means no independent review has been requested. A pending,
changes-requested, malformed, or stale record is always a blocker because the
user already initiated that gate, even when its configured policy is `manual`.
Complete must route a pending or missing required review through the configured
execution flow below rather than treating the manual handoff as unconditional.

## Configured regular quality gates

Use `qualityGates.regular` for this work item:

- **Audit:** `manual` runs only when the user explicitly requests `/audit`;
  `when-sensitive` runs for authentication, authorization, payments, secrets,
  personal or user data, migrations, destructive operations, external side
  effects, security boundaries, or unusually broad changes; `always` runs for
  every work item.
- **Independent review:** `manual` runs only when the user explicitly requests
  `/audit independent current`; `when-sensitive` requires it for the same
  sensitive categories as Audit; `always` requires it for every work item. An
  independent review includes a full current audit, so it satisfies a selected
  Audit gate instead of repeating the audit in the builder session.
- **Check:** `manual` runs only when explicitly requested; `when-behavioral` runs
  when a done-when needs observed runtime behavior such as a click, request, CLI
  command, download, background job, or multi-screen flow; `always` runs for
  every work item.
- **Try guide (`qualityGates.regular.tryGuide`):** use `/check guide`.
  `manual` runs only when explicitly requested;
  `when-user-facing` generates a guide when the change affects UI, navigation,
  copy, a public API or CLI, output, or another workflow a person directly uses;
  `always` generates one for every work item.

Apply automatic gates in this order: `/check`, review, then `/check guide`. When
independent review is selected, follow the independent execution flow below and
continue only after a fresh reviewer writes a current passing receipt. Otherwise
run `/audit current` when Audit is selected.
Reuse adequate evidence produced during the current work item instead of
repeating it. A required gate that cannot run is a blocker. `/check guide` only
generates instructions for human review; never claim the user performed them. P0 and P1
finding blockers remain enforced regardless of these settings.

### Independent review execution

After final Verify and required Check pass, set the active spec to `verified`.
If a selected or previously initiated independent review does not already have a
current passing receipt:

1. Use an existing current pending request and its immutable target when one is
   present. Otherwise show the exact product/test checkpoint candidate and
   verified spec. Include the spec when tracked; an intentionally ignored spec
   uses Audit's local `Spec snapshot` contract without changing visibility.
   Obtain explicit commit approval when the exact checkpoint does not already
   exist, then create or use it under the normal Git rules. Configuration,
   including `review.independentExecution: "automatic"`, never grants permission
   to commit. A pending request without `Requested execution` is legacy and
   manual-only; never add execution fields or run a subagent against it.
   A local-spec-only revision may reuse the same approved product HEAD after
   normal spec and verification gates, with a new snapshot/request and full
   fresh review. Do not create an empty commit for ignored spec changes.
2. Prepare Phase A of `/audit independent current` when no current request
   exists. Record `Requested execution` from `review.independentExecution`.
3. For requested `automatic`, start the generic isolated current-runtime child
   from the installed project-local Audit skill, wait, and validate the normal
   receipt. Freeze parent product, test, spec, and config changes while it runs.
4. For requested `manual`, or when automatic isolation, identity, model,
   completion, or access to the same local spec/snapshot is unavailable,
   preserve the pending request, set activity to `ready`, and stop with the
   manual fresh-session handoff.
5. Continue Complete only with a current passing receipt whose requested and
   actual execution fields match the allowed review contract. Never self-review
   or silently skip the gate.

## Step 0 - final safety pass

Before logging or committing, run a short safety pass and report blockers only:

- active spec exists and the work is not being completed from `main` or `master`
- the branch name uses the configured feature, fix, or rollback prefix
- changed files are tied to the active spec, with no unrelated dirty work mixed
  in (dirty `blueprint/context/findings.md` and
  `blueprint/context/review.md` are expected review evidence)
- the exact `Verify` command from `AGENTS.md` passed in this session, when one is
  declared; otherwise the build passed, and tests passed when the project has a
  declared test command and the change touched logic
- any check required by `qualityGates.regular` has evidence, and there is a clear
  manual try path
- with `verification.logicTests: "required"`, logic changes have a configured
  runner and passing focused tests; otherwise completion is blocked and `/tests`
  is the next setup step
- with `verification.uiEvidence: "required"`, UI done-whens have direct browser
  evidence, including screenshots and relevant console and network checks
- any audit or try guide required by `qualityGates.regular` ran before completion
- a selected independent-review gate has a `passed` receipt whose target equals
  `HEAD`, whose base ref still produces the recorded merge base, whose exact
  spec SHA-256 still matches, whose reviewer adapter and selected model match
  the request, whose required Check result passed, whose receipt sections are
  non-empty, and whose target has no later changes except the review and
  findings files. Apply the same checks to any explicit receipt even when the
  configured policy is `manual`. Any mismatch is stale and blocks completion.
  When `Spec snapshot` is present, also require its exact local bytes, path,
  visibility, and Git conditions from Audit's reference contract to remain valid.
- when a passing independent receipt exists, the active spec is already
  `verified` and remains byte-for-byte unchanged through archival
- if workflow files changed, `.agents` and `.claude` stayed in sync where both
  adapters exist
- no P0 or P1 finding in `blueprint/context/findings.md` is `open` or `fixed`.
  `fixed` still blocks on purpose: the repair exists but no review has looked at
  it - run `/audit` to close it. While the current spec is active, append the
  repair as a new checklist step and run `/implement`; do not start a separate
  `/fix`. After the repair passes its focused check and the finding is marked
  `fixed`, run `/audit current` to re-review the updated code, close the finding,
  and then retry `/complete`. The only waivers are `accepted` (the user's
  explicit decision in the current chat, reason recorded; never set it for
  them) or `invalid` (an `/audit` re-examination verdict with recorded
  evidence, or the user's explicit call). A missing ledger file means no
  findings.

Do not claim "passed", "verified", or "working" without naming the command,
route, screenshot, or output that proves it. Stop before Step 1 if required
evidence is missing.

After this safety pass succeeds, set the active spec's `**Status:**` to
`verified` before archiving it when no independent receipt exists. With a
passing independent receipt, it must already be `verified`; do not rewrite it
after review. Rerun the required final checks either way because `/complete`
owns the final safety pass.

## Step 1 - log the work

Follow `reference/completion-recovery.md` to capture the source tree and compact
archive annotation before any logging edits. Preserve the exact verified spec
prefix, its UTF-8 byte length and SHA-256, branch, original HEAD, and local base.
Record the reference's narrow `absentOptional` proof before creating any optional
findings/review stub on an older installation; tree absence alone is insufficient.
Prepare the entire archive, including the sections below and any generated try
guide, before placing it at its absent destination. An existing matching archive
enters recovery; never overwrite it or append duplicate sections.

Check whether the spec is a feature, fix, or rollback. A fix is marked
`Type: Fix` and has no build-plan number. A rollback is marked `Type: Rollback`
and records the exact target feature, archive, commit, and parent.

- **Feature** - use the verified spec's frozen `**Build attempt:**` and stable ID,
  following `../feature/reference/build-history.md`. Attempt 1 keeps
  `blueprint/history/features/NN-name.md`; N > 1 uses `NN-name--build-N.md`.
  Validate the attempt against prior immutable builds and completed reversals;
  never increment it at completion or resume. For an older active spec without
  the field, derive 1 only with no prior builds, or derive the next attempt only
  from unambiguous prior builds and their proven completed reversals. Keep those
  reviewed spec bytes and the existing branch unchanged; otherwise stop. An
  existing matching archive and its annotation freeze the recovery destination.
  Check the feature off in `blueprint/build-plan.md`
  (and its parent item once all sub-items are checked). Then recompute the
  overview fingerprint using `/overview`'s checkbox-normalized hash contract and
  replace only the existing `blueprint:source-hash` value. Do not regenerate or
  rewrite the overview body. This keeps completion progress from looking like
  plan drift and migrates older exact-byte fingerprints.
- **Fix** - archive it to `blueprint/history/fixes/name.md`. A fix isn't a build-plan item, so
  there's nothing to check off.
- **Rollback** - archive it to
  `blueprint/history/rollbacks/YYYY-MM-DD-<exact-target-archive-stem>.md`, using the
  spec's exact `Target archive` filename without `.md`, including any build suffix.
  Preserve the original completed feature archive. Create
  `blueprint/history/rollbacks/` first if an
  older Blueprint installation does not have it yet. Uncheck the exact target item in
  `blueprint/build-plan.md` and its parent when applicable, then append a concise
  note to the target line with the rollback date and archive path. Keep the
  feature number stable. If the user later decides the feature is permanently
  abandoned rather than pending rebuild, that roadmap decision is a separate
  plan edit.

**Archive resolved findings.** If `blueprint/context/findings.md` holds any
findings, include a `## Findings` section in the prepared archive with
every `closed`, `accepted`, or `invalid` entry at its final status (`accepted`
entries keep their recorded reason). Prefix feature IDs with the normalized stable
ID and, for N > 1, `-build-N`: feature 12's first `F-03` becomes `12/F-03`, while
attempt 2 becomes `12-build-2/F-03`. Derive N from the verified spec/history proof,
never arbitrary filename text. Fixes and rollbacks use their archive filename as
the prefix. An entry carried forward from earlier work archives with the item that
resolved it; its **Found** line preserves
where it came from. Only `closed`, `accepted`, and `invalid` entries are
resolved for archival. A `fixed` entry is not resolved at any severity: never
append it to the archive or remove it from the live ledger.

**Archive independent review.** When a current `passed` receipt exists, include
a `## Independent review` section in the prepared archive with the receipt fields,
commands, safe evidence references, findings, and remaining risk from
`blueprint/context/review.md`. Preserve the full target and base SHAs, spec
hash, the original `Spec snapshot` field when present, base ref, builder adapter
and model, requested reviewer, model, and execution, actual reviewer adapter,
model, and execution, Check result, fresh-context declaration, and review time.
Do not archive a stale, pending,
changes-requested, or malformed record.

Validate and place the fully assembled archive first. Complete only the exact
plan/overview changes above and any approved consumed-prototype cleanup below.
Read the archive back and confirm that its spec, findings, and review match their
inputs before resetting live evidence. Reset the active spec last.

**Discard consumed prototypes.** If this feature built the look from `prototypes/`
- its Design reference pointed there and an early step ported `prototypes/theme.css`
into the app - delete the `prototypes/` folder now. The tokens live in the real
stylesheet and the HTML mockups were always throwaway; fold the deletion into this
feature's commit. Skip this if the feature didn't consume prototypes.

Then remove only the archived entries from the ledger. Entries with `open`,
`fixed`, or `unverified` status stay in the ledger with their IDs so they are
never silently dropped. A fixed P2/P3 finding does not block completion, but it
must remain verbatim for a later `/audit` re-review. When no `open`, `fixed`, or
`unverified` entries remain, reset the ledger to exactly this stub, and create it the
same way if the file is missing (an older install):

    # Findings

    > **Generated file.** The findings ledger: review findings raised by `/audit`
    > against the work in progress, each with a durable ID, severity (P0-P3), and
    > status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
    > moves them to `closed`, and `/complete` refuses to land while any P0 or P1
    > finding is `open` or `fixed`, then archives resolved findings with the work
    > and resets this file.

    _No findings recorded. `/audit` appends findings here when it finds them._

Then reset `blueprint/context/review.md` to exactly this stub, creating it when
an older installation does not have it:

    # Independent Review

    > **Generated file.** Holds the active independent-review request or latest
    > receipt for the current work item. `/audit independent current` prepares a
    > handoff against an approved checkpoint, a fresh reviewer context completes it,
    > and `/complete` refuses stale, pending, or changes-requested review state.

    _No independent review requested. Run `/audit independent current` to prepare one._

Keep every unresolved entry in the ledger. Do not replace it with the empty stub
while it still contains any open, fixed, or unverified finding. After archiving
resolved findings, replace `blueprint/context/current-feature.md` with
the canonical stub below. Do not paraphrase it or substitute an abbreviated "no
work" stub. Before committing, read the file and confirm it exactly matches:

    # Current Feature

    > **Generated file.** Holds the one feature, fix, or rollback being built in this checkout. Run
    > `/feature <number-or-name>` to spec a build-plan feature, or `/fix "<bug>"` for
    > an ad-hoc fix. Use `/rollback <completed-feature>` to plan a safe reversal.
    > Build one thing at a time in this checkout; `/complete` archives it under
    > `blueprint/history/` and resets this file.

    _Nothing in progress. Run `/feature`, `/fix`, or `/rollback` to start._

When no open, fixed, or unverified ledger entries remain, confirm
`blueprint/context/findings.md` exactly matches the canonical Findings stub
above. Otherwise, preserve the remaining entries without rewriting them.
Confirm `blueprint/context/review.md` exactly matches the canonical Independent
Review stub above.

Don't commit yet; the next step makes one work commit covering the code and these
documentation changes. The archive is the build history.

## Step 2 - make the work commit

Show the complete product and logging diff with the proposed commit message,
then obtain explicit commit approval. Only then stage the reviewed branch work
(any uncommitted step work plus the Step 1 logging changes) and make one conventional work commit (for example `feat: <feature>`,
`fix: <name>`, or `revert: roll back <feature>`). `Verify`, or the fallback build
and tests, must pass first.

## Step 3 - land the work

Follow only the configured path.

### Local merge

With `git.landing: "local-merge"`:

1. Confirm the recorded local default branch has not advanced and the final work
   commit is unchanged. Squash-merge into that default branch only with the user's
   explicit go-ahead, so the work lands as one clean commit regardless of how many
   checkpoints the branch carried.
2. Verify the resulting default-branch commit, parent, archive, and full tree
   using `reference/completion-recovery.md`, then perform approved branch cleanup.
3. Stop and ask whether to push the local default branch to its upstream. The
   merge approval does not count as push approval.
4. Push the default branch only after a separate explicit yes in the current
   chat. If the repo has no remote or upstream, say so instead of guessing.

### Pull request

With `git.landing: "pull-request"`:

1. Require a selected configured remote, a known remote default branch, and an
   available authenticated hosting CLI or API. Prefer the work branch's configured
   upstream remote; otherwise use the only unambiguous remote or ask the user to
   choose. Confirm the exact work commit and branch are unchanged. Do not fall
   back to a local merge or direct default-branch push when any prerequisite is
   missing.
2. Show the target remote and base branch, exact branch to push, proposed pull
   request title, and concise body. State that the pull request must use squash
   merge to preserve Blueprint's one-work-item, one-default-branch-commit history.
3. Obtain one explicit approval for the feature-branch push and pull request
   creation. Configuration never supplies this approval. Only after approval,
   push that branch with upstream tracking and open the pull request against the
   confirmed default branch.
4. Verify that the pull request head is the exact final work commit and report its
   URL plus check status. Never merge the pull request, enable auto-merge, delete
   the remote branch, or push the default branch from this approval.
5. Stop with the work ready for provider review and squash merge. If `/complete`
   is resumed after the provider reports it merged, follow
   `reference/completion-recovery.md`; verify the exact pull request and squash
   commit before reporting completion or offering local branch cleanup.

Then point the user at `/feature`, `/fix`, or `/rollback` for the next thing.

Finish with a concise **How to try it** note for the completed work. For a
rollback, explain how to confirm the removed behavior is gone and name one
unaffected regression path. If the
manual path is more than a couple of steps, tell the user to run `/check guide latest`;
that command can read the archived feature after `current-feature.md` is reset.

## Rules

- The work item is the unit of history: one squashed feature, fix, or rollback
  commit on the default branch, even if the branch carried several checkpoint
  commits.
- A rollback preserves the original feature archive and adds a separate rollback
  archive. Never rewrite history to make the feature look as if it never existed.
- Don't merge unfinished or failing work. The documented `Verify` command, or
  the fallback build and tests, must pass first.
- Never merge while a P0 or P1 finding is `open` or `fixed` in the ledger. The
  recorded ways past the gate without code are `accepted` (only by the user's
  explicit decision, with their reason) or `invalid` (only from re-examination
  evidence or the user's explicit call); both travel into the archive, never a
  silent drop.
- Never merge with a required or explicitly initiated independent review that
  is missing, pending, changes-requested, malformed, or stale. The user may
  explicitly cancel a manual review before completion, but the agent never
  resets or waives it on the user's behalf.
- Merging and pushing are the user's calls. Local landing needs explicit merge
  approval, then separate default-branch push approval. Pull-request landing needs
  explicit branch-push and pull-request approval, and never includes merge approval.
- Never treat `/complete`, configuration, or "looks good" as permission to push,
  open a pull request, enable auto-merge, or merge.
- One item per completion. If a parent feature still has unchecked sub-features,
  leave the parent unchecked.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
