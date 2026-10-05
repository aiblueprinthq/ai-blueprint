---
name: continuous
description: Build every remaining planned feature serially in explicit Continuous Mode, with one local branch, verification cycle, commit, archive, and local merge per feature. Stop on decisions or blockers and never push or deploy. Use only for /continuous, $continuous, or a direct Continuous Mode request.
disable-model-invocation: true
---

# continuous - complete the build plan one local feature at a time

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    /status  ->  [continuous]  ->  final review packet
    (ready)      (feature loop,    (local main only,
                  local history)    never pushed)

Continuous Mode is an explicit opt-in loop for completing planned features
without pausing at normal review prompts. It preserves the same file-backed state,
small steps, verification, findings ledger, branches, archives, and one clean
main commit per feature that a careful human workflow would produce.

A direct Continuous request authorizes these local actions for this run:

- create and switch local feature branches
- create configured checkpoint commits on those branches
- create required immutable independent-review checkpoints
- create the final local feature commit
- squash-merge a completed feature into the local default branch
- delete the merged local feature branch
- repeat with the next unchecked build-plan item

It does not authorize push, deploy, publish, send, remote changes, destructive
actions, database resets, irreversible migrations, finding acceptance, failed
check waivers, or product decisions. It always stops before those actions.

## Input and target selection

Before selecting an item or requiring a live active spec, inspect pending
completion using the installed Complete skill and
`../complete/reference/completion-recovery.md`. Use its read-only candidate screen
first: settled clean default-branch history needs no historical transient objects
for a new run. An actual completion candidate or an explicit request to resume
interrupted completion requires full recovery proof, using this run's scoped Git
authority and
`qualityGates.continuous`. Do not repeat archival or a work commit/merge. Missing,
conflicting, or unprovable recovery evidence stops before next-feature work. An
active feature with no completion candidate resumes implementation normally; its
ordinary `resume` does not require an archive or completion proof.

With no argument after pending completion has been reconciled:

1. Resume an active feature in `blueprint/context/current-feature.md`.
2. Otherwise select the next unchecked leaf item in
   `blueprint/build-plan.md`.
3. Continue in build-plan order until no unchecked leaf remains or
   `continuous.maxFeatures` completed features have been counted.

`resume` explicitly resumes the active feature or its pending completion.
A feature number or name may set
the starting item only when no different work item is active. After that item,
continue with the next unchecked leaf items in normal build-plan order.

Continuous Mode handles planned features only. If the active work is a fix or
rollback, stop and point to its normal reviewed workflow. Never overwrite active
work to make the requested target fit.

## Step 1 - preflight once

Read:

- `AGENTS.md`
- `blueprint/config.json`
- `blueprint/project-plan.md`
- `blueprint/build-plan.md`
- `blueprint/context/project-overview.md`
- `blueprint/context/current-feature.md`
- `blueprint/context/findings.md`
- `blueprint/context/coding-standards.md`
- `blueprint/context/ai-interaction.md`
- git branch, status, default branch, upstream state already known locally, and
  recent log

A missing config means built-in defaults. If it exists but is invalid, stop and
point to `/doctor`.

Start only when the state is safe:

- The project is a Git repository.
- The working tree is clean on the default branch, or all dirty work belongs to
  the active feature on its matching configured feature branch, including a
  proven pending completion handled through the recovery contract.
- The build plan is a valid ordered checkbox plan with at least one remaining
  leaf, unless resuming an active feature or its pending completion.
- The overview is current. If it is stale but both plans are clear and
  consistent, refresh it using the `/overview` behavior and include that change
  with the first feature. Stop when refreshing it needs a product decision.
- Existing P0 or P1 findings are not `open` or `fixed`.
- Project commands and the exact `Verify` command, when declared, are usable.
- The requested feature does not conflict with active work.

Do not fetch, pull, install dependencies, start an unauthorized server, alter
remote settings, or clean unrelated work during preflight. A known-behind
default branch is a stop, not permission to pull.

Record the starting default-branch commit. This bounds the optional final
integration audit and the final report.

The initial `blueprint/.state/run.json` record required by `AGENTS.md` must
already show command `continuous` and status `running` before preflight begins.
After preflight passes, enrich it with boundary `local-only`, the current
feature, and completed-feature progress against the smaller of the remaining
queue or configured limit. Update it when
a feature starts, after every passing build step, after each quality gate, and
after each local main commit. On a stop, set status `blocked` with
`/continuous resume` when resuming is safe. At the end of the queue or limit,
set status `completed` and retain the final progress. Activity reporting must
never weaken or block the workflow itself.

## Step 2 - run one feature lifecycle

Repeat this section serially. Never have two feature branches or specs active at
once.

### 2.1 Select and spec

When resuming, keep the active spec and continue from its first unchecked build
step.

For a new item, apply the `/feature` behavior to the selected build-plan leaf,
write `blueprint/context/current-feature.md`, and self-review the spec before
coding. Correct missing unhappy paths, oversized steps, undefined contracts,
scope drift, vague done-whens, missing design references, and missing testing
plans.

Do not invent an unanswered product, data, architecture, auth, billing, or visual
decision. Stop with the exact decision needed.
Follow the proportional-engineering contract in `AGENTS.md` throughout this run.

### 2.2 Create or resume the feature branch

Use the exact `**Branch:**` frozen in the spec, including its `**Build attempt:**`
suffix when applicable; do not derive a new branch or attempt from the title.
Validate it against `git.featureBranchPrefix` and Feature's history rules, then
create it from the current local default branch. When resuming, require the
existing branch and active spec to agree; keep Complete's legacy attempt handling
for older specs rather than renaming a reviewed branch.

If switching would strand unrelated work or the default branch changed in a way
that makes the active branch unsafe to integrate, stop. Never stash, reset, or
discard work automatically.

### 2.3 Implement small steps

Build the spec in order, one small diff at a time. Continuous Mode does not pause
for `workflow.stepReview`; its explicit invocation replaces those review
prompts with self-review plus the final packet.

For each step:

1. Implement only that step.
2. Show or retain a readable diff and explain it in the ongoing progress update.
3. Run the exact documented `Verify` command when present. Otherwise run the
   documented build and existing relevant tests.
4. Enforce `verification.logicTests` and `verification.uiEvidence`.
5. Self-review scope, error paths, security boundaries, project conventions, and
   tests.
6. Repair failures within scope, rerun affected evidence, and check off the step
   only when it passes.
7. When `workflow.checkpointCommits` is `enabled`, create a conventional local
   checkpoint commit containing that passing step and its checked spec state.
   When disabled, keep the work uncommitted until feature completion.

Never collapse an oversized step into an unreadable diff. Split the step in the
spec and continue. A dependency install, new service, destructive operation, or
decision outside the approved plans is a hard stop.

### 2.4 Apply Continuous quality gates

Use `qualityGates.continuous`, not the regular or Autopilot gates:

- **Audit:** `manual` skips automatic audit; `when-sensitive` runs
  `/audit current` for authentication, authorization, payments, secrets,
  personal or user data, migrations, destructive operations, external side
  effects, security boundaries, or unusually broad changes; `always` audits
  every feature.
- **Independent review:** `manual` skips automatic independent review;
  `when-sensitive` requires a fresh reviewer for the same sensitive categories
  as Audit; `always` requires a fresh reviewer for every feature. A passing
  independent receipt satisfies the Audit gate for that feature.
- **Check:** `manual` skips automatic `/check`; `when-behavioral` runs it
  when a done-when needs observed runtime behavior such as a click, request, CLI
  command, download, background job, or multi-screen flow; `always` checks
  every feature.
- **Try guide (`qualityGates.continuous.tryGuide`):** use `/check guide`.
  `manual` skips automatic generation; `when-user-facing`
  generates a guide for UI, navigation, copy, public API or CLI, output, or
  another workflow a person directly uses; `always` generates one for every
  feature.

Run required gates in this order: check, review, then try guide. Use independent
review instead of a builder-session audit when both are selected. `manual` means
the capability remains available later but is not automatic during this run.
A try guide is instructions for human review, never proof it was performed.

When a gate cannot run, stop instead of recording a pass. Existing P0/P1 ledger
blockers always apply even when audit is manual.

### 2.5 Repair and re-review findings

Validate audit findings before editing. Repair confirmed P0 and P1 findings only
when the repair stays within feature scope, needs no user decision, and does not
remove or change shipped behavior. Use `continuous.maxRepairAttempts` as the
maximum attempts for the same failing check or finding; `0` disables automatic
repair.

After a repair, rerun affected verification and acceptance evidence, then
re-audit the repaired area. Move `fixed` to `closed` only when the audit
confirms the defect is gone and no worse issue was introduced.

Report P2 and P3 findings. Fix only small defects directly caused by the current
feature and clearly required by project standards. Never mark a finding
`accepted` for the user or suppress a failing check.

Any P0 or P1 left `open` or `fixed` stops the loop before completion.

When independent review is selected, ensure application code is in a clean
immutable checkpoint. First rerun final verification and the selected Check
gate and set the spec status to `verified`. Include the exact spec when tracked;
an intentionally ignored spec uses Audit's local `Spec snapshot` contract
without changing visibility. This review checkpoint is covered by Continuous
Mode's scoped local lifecycle authority even when step checkpoint commits are
disabled. Then follow
`/audit independent current`. With `review.independentExecution: "automatic"`,
spawn and wait for the isolated reviewer and validate its normal receipt before
continuing. With `manual`, or when automatic capability cannot prove isolation,
identity, model, completion, or access to the same local spec/snapshot, set
activity to `ready` and stop with the manual handoff. Continuous Mode never
performs its own independent review. On `/continuous resume`, continue only with
a current `passed` receipt. For
`changes-requested`, repair within the configured attempt limit, obtain a new
checkpoint, and review the whole new target again.
A local-spec-only revision may reuse the same approved product HEAD after normal
spec and verification gates, with a new snapshot/request and full fresh review.
Do not create an empty commit for ignored spec changes.

The request records `Requested execution`; the receipt records `Actual
execution`. Require the execution and reviewer-context pairing defined by the
project-local review contract before continuing the feature loop.
A pending request without `Requested execution` is legacy manual-only. Never add
execution fields or run a subagent against it.

### 2.6 Complete locally like a human

Apply the `/complete` safety, logging, and archive behavior without asking the
normal commit and local-merge prompts, because the explicit Continuous request
already authorized those local actions.

For the finished feature:

1. Run the final documented verification in the current session.
2. Confirm the current spec's `**Status:**` is `verified`. When an independent
   receipt exists, do not rewrite the reviewed spec before archival.
3. Confirm all steps are checked, configured gates ran, no unrelated files are
   mixed in, adapters remain aligned, and no P0/P1 blocker remains.
4. Reuse the spec's frozen build attempt and exact Complete archive destination.
   Capture Complete's source-tree/annotation proof before any logging edits,
   recording `landing` as `local-merge` even when project configuration selects
   pull-request landing for the regular workflow.
   Fully prepare the archive with the exact verified spec, resolved findings,
   original passing receipt, and any generated `## Manual try guide` section.
5. Validate and place that archive, update the exact build-plan item/parent and
   overview hash, then reset live evidence last using Complete's canonical rules.
   Preserve unresolved findings; reuse a matching archive during recovery.
6. Commit remaining branch work with one conventional feature-level message.
7. Switch to the local default branch, squash-merge the feature branch, and
   create one conventional commit containing product work, tests, and Blueprint
   history.
8. Delete the merged local feature branch.
9. Confirm the default branch is clean before selecting the next feature.

Never merge a partial or failing feature. Never push the default branch.

Count the feature toward `continuous.maxFeatures` only after its local main
commit succeeds. On resume, reconcile the unique proven archive/default-commit
pairs already completed in this run before incrementing; cleanup or a repeated
resume never counts the same completion twice. If the run boundary or count
cannot be recovered for an explicit `resume`, stop for clarification instead of
resetting the count and exceeding the requested limit. A new invocation starting
from a clean default branch records that current tip as its new run boundary;
already-completed work at or before it does not count toward the new run or
require reconstruction of an older run's count.

## Step 3 - optional final integration audit

After the loop reaches its feature limit or the end of the build plan, run this
step only when `continuous.finalIntegrationAudit` is `true`.

Audit the combined default-branch diff from the recorded starting commit through
the current `HEAD`, focusing on cross-feature contracts, integration seams,
security boundaries, regression risk, and missing tests. Record findings in the
ledger.

For a confirmed P0 or P1 introduced by this run, automatic repair may use one
dedicated configured fix branch and the same repair-attempt limit only when no
product decision or scope expansion is required. Spec, verify, archive, locally
squash-merge, and delete that fix branch like normal Blueprint fix work. Re-audit
the repair before closing the finding.

Otherwise stop with the finding open. Do not hide it, widen into general
hardening, or present the run as fully ready.

## Step 4 - stop and report

A successful stop occurs when:

- every build-plan leaf is checked, or
- `continuous.maxFeatures` successful features were completed.

A blocked stop occurs immediately for:

- invalid or conflicting Blueprint state
- unrelated dirty work or branch drift
- an unanswered user or architecture decision
- missing design evidence for visual replication work
- unauthorized dependency, network, external-service, or destructive work
- failed verification or a gate that cannot run
- the configured repair-attempt limit
- an unresolved P0 or P1 finding
- a pending, changes-requested, malformed, or stale independent review
- merge conflict or default-branch integration drift

On a mid-feature stop, preserve the feature branch, checked steps, commits, and
working tree exactly as they stand. Do not merge or delete it. A later
`/continuous resume` picks up from that state.

On any stop, report:

- starting and ending default-branch commits
- features completed this run, each local commit, and branch cleanup state
- active feature and next unchecked step, if blocked mid-feature
- exact checks and quality gates run per feature
- generated try-guide archive locations
- audit findings and repairs
- current build-plan progress and next unchecked item
- why the loop stopped
- default branch ahead-of-upstream state already known locally
- explicit reminder that nothing was pushed

## Rules

- One project, one feature, and one branch at a time.
- No user-supplied feature list is required. The build plan is the queue.
- Preserve small implementation steps and one clean local main commit per
  completed feature.
- `workflow.stepReview` does not pause Continuous Mode.
- `workflow.checkpointCommits` controls step checkpoints, not the required
  feature-level local history.
- Continuous quality gates control automatic audit, independent-review, check,
  and try-guide work.
  They never weaken Verify, testing, UI evidence, or P0/P1 blockers.
- Explicit Continuous invocation authorizes only the local Git lifecycle
  described here.
- Never push, deploy, publish, send, mutate remote services, or perform
  destructive actions.
- Never accept findings, waive failures, or make product decisions for the user.
- Stop truthfully. A resumable blocked run is better than fabricated progress.

## Formatting

Follow `blueprint/context/ai-interaction.md`. Keep progress updates concise and
feature-oriented. The final packet must be readable without the intermediate
updates.
