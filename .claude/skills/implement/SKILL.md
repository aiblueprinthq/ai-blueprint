---
name: implement
description: Start coding or resume the approved current feature, fix, or rollback on its branch, testing each step and presenting review. Use for /implement or building current-feature.md.
disable-model-invocation: true
---

# implement - build the approved spec

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

The approved `blueprint/context/current-feature.md` is the authoritative feature
packet. Implement it and stop before the work-level commit or merge.

## Start

**First action:** Before project inspection, preflight, or any other tool call,
publish the `implement` activity as `running` when `blueprint/.state/` exists.
Combine it with the first preflight tool batch when supported.

In one preflight batch, read:

- `blueprint/config.json`
- `blueprint/context/current-feature.md`
- the current branch, status, and recent relevant log
- the Commands section already loaded from `AGENTS.md`

Stop for `/doctor` on invalid config. Stop for `/feature`, `/fix`, or `/rollback`
when the active spec is empty. Preserve unrelated worktree changes.

Do not reread the full project overview, coding standards, interaction guide,
history, findings, or review ledger before coding. The approved spec already
contains the product contract and applicable conventions. Read one targeted
section only when the spec explicitly depends on a missing detail. Read findings
and review state once at the final handoff.

Inspect the implementation surface in one targeted, batched read before editing.
Use one additional read batch only when an exact dependency remains unknown and
blocks the next change. Do not list or survey the repository, inspect unrelated
examples, or run scratch environment probes. Follow the declared runtime and
existing target-area patterns, then let the narrow check expose incompatibilities.

Resolve the work branch before editing. Use the exact `**Branch:**` value in the
spec when present. For an older spec without it, combine the configured prefix
for its type with the work title: lowercase ASCII letters and digits, replace
each run of other characters with one hyphen, and trim edge hyphens. Feature
titles come from the named build-plan item; fix and rollback titles come from
their spec heading or target. Stop if the type or title is ambiguous. Create or
switch to that exact branch and never implement on the default branch. On
resume, start at the first unchecked build step and use git status plus the
checked boxes to distinguish finished work from unfinished work.

If the spec says `Type: Rollback`, read and follow
`reference/rollback-implementation.md` before changing product files. Do not load
that reference for a feature or fix.

## Build loop

Follow build steps in order. Build only what the spec says. If a step requires an
unresolved product decision, unsafe action, missing prerequisite, or material
scope expansion, stop and revise the spec instead of improvising.

Add an abstraction, dependency, service, configuration surface, compatibility
layer, or security mechanism only when the approved spec or an established
repository requirement needs it now. Prefer existing code, the standard library,
native platform features, and installed dependencies. If the simplest complete
implementation conflicts with the spec, stop and revise the spec instead of
silently building a larger design.

For each step:

1. Make the smallest coherent change that satisfies its `Done when`.
2. Add focused tests with logic when a test runner is configured. Never install
   a runner or runtime dependency unless the spec authorizes it.
3. Run the narrowest useful check while iterating. Do not run the full Verify
   command after every step when `workflow.stepReview` is `feature`; run it once
   after all steps. Run Verify earlier only when the step explicitly requires it
   or later work cannot proceed without it.
4. Self-review the diff for contract coverage, authorization and tenant scope,
   error handling, accidental scope, and unrelated changes.
5. Check the step box only after its code and focused check pass. Mark a repaired
   finding `fixed`, never `closed`.

With `verification.logicTests: required`, any logic-bearing step stops and
points to `/tests` when no test runner is configured. Its focused logic tests
must pass before the step can be checked. With `verification.uiEvidence:
required`, a UI done-when cannot pass on build output alone. Capture the
configured browser evidence, or stop and ask the user to start the required
server when live evidence cannot run automatically.

With `workflow.stepReview: feature`, continue through passing steps and present
one final review packet. With `workflow.stepReview: every`, stop after each step
with the diff, a short explanation, evidence, and a manual try path when one
exists. Continue only after approval.

Checkpoint commits are offered only when `workflow.checkpointCommits` is
`enabled` and the current review gate was approved. Never commit without current
approval. `/complete` owns the final work-level commit and merge.

Do not create a separate tool round merely to narrate a passing internal step.
Keep the durable checkbox current and continue. Split a step when its diff is too
large to review.

Before final verification, compare every In scope item and `Done when` against
the finished diff. For user-facing work, inspect the reachability and error
classification of each required state. Catch only known expected errors at a
boundary; unexpected failures must reach the unexpected-error path. Fix any
missing or contradicted contract before marking the spec verified.

Run a proportionality check before final verification: every new abstraction,
dependency, service, configuration surface, compatibility layer, and security
mechanism must trace to the approved spec or an established repository
requirement. Remove speculative machinery this work added without weakening real
trust-boundary validation, data-loss prevention, accessibility, or configured
verification.

## Verification

After all steps pass, run the project's final automated gate once. If
`AGENTS.md` declares a `Verify` command, run that exact command. Otherwise run
the fallback build and tests that are actually declared. Never claim a check
passed without its output.

Apply configured regular gates:

- Audit and independent review follow `qualityGates.regular`.
- Check runs for `always`, for behavioral work under `when-behavioral`, or when
  explicitly requested.
- `/check guide` follows `qualityGates.regular.tryGuide`: it runs for `always`,
  for user-facing work under `when-user-facing`, for work with a safe meaningful
  direct observation under `when-testable`, or when explicitly requested.

After final Verify and required Check pass, apply the selected try-guide policy.
For `when-testable`, let `/check guide` perform its conservative classification.
Keep its generated `## Try it now` section for the final packet. When no safe,
meaningful direct observation exists, record that the gate was skipped and do
not fabricate a section. Guide output never counts as verification or user
acceptance.

Do not start a dev server. When a required runtime check needs one, ask the user
to start it. Build output does not prove visual, persisted-data, authenticated,
or end-to-end behavior.

If Verify or a required gate fails, repair only in-scope defects, rerun the
narrow failing check, then rerun the final gate. Stop on repeated failure,
missing infrastructure, or a product decision.

After final Verify and required Check pass, set the active spec to `verified`
with every completed box checked. Then resolve independent review before the
final packet:

1. If `qualityGates.regular.independentReview` does not select review and no
   request already exists, proceed directly to the final review packet.
2. Otherwise show the exact product/test checkpoint candidate and verified spec.
   Include the spec when tracked; an intentionally ignored spec uses Audit's
   local `Spec snapshot` contract without changing visibility. Obtain explicit
   commit approval when the exact checkpoint does not already exist, then create
   or use it. Configuration, including `review.independentExecution: "automatic"`,
   never grants commit permission, even when normal checkpoint commits are disabled.
   A local-spec-only revision may reuse the same approved product HEAD after
   normal spec and verification gates, with a new snapshot/request and full
   fresh review. Do not create an empty commit for ignored spec changes.
3. Follow `/audit independent current` to prepare or reuse the request and record
   `Requested execution`. For requested `automatic`, start and wait for the
   generic isolated current-runtime child instructed from the project-local
   Audit skill, then validate the receipt. For requested `manual`, or when
   automatic capability or access to the same local spec/snapshot is unavailable,
   preserve the request and stop with the manual fresh-session handoff. Treat an
   existing request without `Requested execution` as legacy manual-only:
   never add execution fields or run a subagent against it.
4. Continue to the final packet only with a current passing receipt whose
   requested execution, actual execution, and reviewer context form an allowed
   pairing. Never self-review or silently skip a selected gate.

## Final handoff

Read `blueprint/context/findings.md` and `blueprint/context/review.md` once.
Open or fixed P0/P1 findings block `/complete`. Repair an open blocker as a new
spec checklist step, mark it fixed after its check passes, then send it back to
`/audit` for closure. Only the user can accept a finding.

When all steps and required gates pass:

- Update activity to `ready` with `/complete` as the resume command.
- Present the branch, changes grouped by area, exact checks run, findings and
  independent-review state, known risks, configured gate outcomes, and
  `/complete` as the next action.
- Include the generated `## Try it now` section verbatim when guide mode produced
  one. Do not replace it with a vague summary or a pointer. When the selected
  policy found no safe direct path, omit the section and state that outcome with
  the gate results.

After the final packet, always offer these choices:

1. Walk me through the implementation.
2. Request changes.
3. Continue to the exact next workflow command.

The final walkthrough is available with either `workflow.stepReview` value and
regardless of `workflow.checkpointCommits`. It is a read-only code tour, not the
manual product-review path produced by `/check guide`, and it is not verification.

When the user chooses the walkthrough, begin with a short map of the completed
feature, then follow the spec's build steps. For each step, explain its purpose,
key files and symbols, important data or control flow, and non-obvious decisions.
Use file and line links when the client supports them. Do not narrate every line
or reload broad project context. End by offering a focused deep dive into one
named area. If the feature spans too many distinct areas for one useful pass,
name the sections first and let the user choose where to begin. Remain read-only
unless the user separately requests changes.

Never create an ordinary step, product, or work-level commit from this skill.
The sole exception is exactly one immutable independent-review checkpoint after
showing its exact candidate and receiving current explicit commit approval.
Configuration never supplies that approval. Never merge, push, deploy, publish,
or start unrelated work from this skill.
