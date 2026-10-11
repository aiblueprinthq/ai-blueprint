---
name: autopilot
description: Run one explicit bounded Blueprint spec and implementation pass through configured quality gates, then stop before completion or external actions. Use only when the user directly invokes /autopilot, $autopilot, or asks for Autopilot.
disable-model-invocation: true
---

# autopilot - optional Blueprint loop

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    /status  ->  [autopilot]  ->  review packet  ->  /complete
    (where       (spec, build,      (human review,    (log, commit,
     are we?)     configured gates)  fixes if needed)  merge with approval)

Autopilot is an explicit opt-in path. It uses the same Blueprint files and the
same quality gates, but it does not stop after every normal review point. A
single user request is permission to run one bounded loop until the feature is
ready for review, blocked, or unsafe to continue.

It combines `/feature` or `/fix` with `/implement` and continues through the
spec-review stop retained by the normal workflow. That human spec approval is
the main control Autopilot intentionally removes. It does not remove the final
review packet or the option to walk through the completed code.

It does **not** replace the normal workflow. `/feature`, `/implement`, `/check`,
and `/complete` remain the conservative default.

Do not suggest Autopilot as the default next action. Use it only when the user
explicitly asks for it.

The explicit Autopilot request is permission to create checkpoint commits on the
feature or fix branch after passing implementation steps when
`workflow.checkpointCommits` is enabled. It is not permission to merge, push,
deploy, publish, send, delete data, or run destructive actions.

## Input

Common forms:

- No argument: resume the current feature if one exists, otherwise target the next
  unchecked build-plan item.
- A number or name: target that build-plan feature, for example `/autopilot 3` or
  `$autopilot "directory listing"`.
- `fix "<issue>"`: write and build an ad-hoc fix spec.
- `resume`: continue the current feature on its existing branch.

If the requested target conflicts with a feature already in progress, stop and
ask which one should win. Do not overwrite `blueprint/context/current-feature.md`
silently.

Rollback is intentionally excluded from Autopilot. If the request is a rollback
or `current-feature.md` is marked `Type: Rollback`, stop and direct the user to
the reviewed `/implement` path. Reversing completed work requires the explicit
dependency and conflict gates in `/rollback` and `/implement`.

## Step 1 - preflight like /status

Read the same state `/status` reads:

- `AGENTS.md`
- `blueprint/config.json`
- `blueprint/project-plan.md`
- `blueprint/build-plan.md`
- `blueprint/context/project-overview.md`
- `blueprint/context/current-feature.md`
- `blueprint/context/findings.md`
- `blueprint/context/coding-standards.md`
- `blueprint/context/ai-interaction.md`
- git branch, status, and recent log

Then decide whether it is safe to run.

Stop before changing files when:

- `blueprint/config.json` exists but is invalid. Point the user to `/doctor`.
- The repo is not a git repo.
- The working tree is dirty and there is no current feature tying those changes
  to this run.
- `current-feature.md` has real work and the user requested a different target.
- `project-overview.md` is missing or stale and the planning docs are not clear
  enough to regenerate it.
- The next feature is visual or replication-heavy and no design reference exists.
- The task needs product, data, auth, billing, or destructive decisions the docs
  do not answer.

If the only issue is that `project-overview.md` is stale and the plans are clear,
regenerate it using the `/overview` behavior and continue. Include that in the
final packet.

The initial `blueprint/.state/run.json` record required by `AGENTS.md` must
already show command `autopilot` and status `running` before preflight begins.
After preflight passes, enrich it with boundary `reviewed`, the target feature
or fix, and build-step progress when known. Update it after the spec, each
passing build step, and each configured gate. On a hard
stop, set status `blocked` with `/autopilot resume` when resuming is safe. At the
final review packet, set status `ready` because Autopilot stops before
`/complete`. Activity reporting must never weaken or block the workflow itself.

## Step 2 - choose or write the spec

If `blueprint/context/current-feature.md` already contains an active spec,
resume it. Read checked steps and continue from the first unchecked step.

If there is no active spec:

1. Use the `/feature` behavior for a planned feature, or `/fix` behavior for a
   requested fix.
2. Write `blueprint/context/current-feature.md`.
3. Red-team the spec before building:
   - missing unhappy paths
   - oversized steps
   - undefined contracts
   - missing design reference
   - scope creep
   - vague done-whens
   - missing testing plan when `AGENTS.md` declares a test command
4. Apply the spec fixes.

Autopilot may continue past this spec gate because the user explicitly invoked
Autopilot. Still report what the critique changed in the final packet.
Follow the proportional-engineering contract in `AGENTS.md` throughout this run.

## Step 3 - create or reuse the branch

Use the same branch rules as `/implement`:

- Feature: the configured feature prefix, default `feature/<name>`
- Fix: the configured fix prefix, default `fix/<name>`

If the branch already exists, switch to it only if it matches the active spec.
If switching branches would strand unrelated dirty work, stop and report the
problem.

## Step 4 - implement in small steps

Work through the spec's build steps in order. Each step must remain reviewable.
Do not pause for user approval after each passing step, regardless of the
configured `workflow.stepReview` value. The review happens at the final packet
unless a hard stop is hit.

For every step:

1. Implement only that step.
2. Run the relevant verification:
   - the exact `Verify` command from `AGENTS.md`, when declared
   - otherwise the build, relevant test, lint, and typecheck commands already
     documented by the project
   - browser, CLI, API, or app-level evidence for behavioral done-whens
   - with `verification.logicTests: "required"`, stop and point to `/tests` if
     logic changed but no test runner is configured
3. If UI is involved, inspect the running app when possible. Prefer Playwright if
   it is already installed or declared. Capture screenshots when they add useful
   evidence. Check for console errors and failed requests.
   With `verification.uiEvidence: "required"`, direct browser evidence is
   mandatory and unavailable evidence is a hard stop.
4. Self-review the diff for the step:
   - does it match the spec?
   - did it add scope?
   - is the error path handled?
   - did it follow `coding-standards.md`?
   - are tests present for new in-scope logic when the test gate is on?
5. Fix obvious issues and rerun the failed checks.
6. Mark the step checked in `current-feature.md` only after the step passes.
7. When `workflow.checkpointCommits: "enabled"`, create a checkpoint commit on
   the feature or fix branch for the passing step. Include the code, tests, and
   the updated `current-feature.md` checkbox. Use a conventional message such as
   `feat: checkpoint mock snapshot route` or `fix: checkpoint stale service
   filter`. Keep the message about the step, not about Autopilot. When the value
   is `disabled`, leave the passing step uncommitted for the final review.

Do not batch the whole feature into one large diff. If a step gets too large,
split the step in `current-feature.md` and continue with the first smaller step.

## Step 5 - configured acceptance check

After all implementation steps are checked, apply
`qualityGates.regular.check`:

- `manual` - skip the automatic `/check`; it remains available when explicitly
  requested.
- `when-behavioral` - run `/check` when a done-when needs observed runtime
  behavior such as a click, request, CLI command, download, background job, or
  multi-screen flow.
- `always` - run `/check` for every work item.

After the required verification and configured Check gate pass, set the current
spec's `**Status:**` to `verified` before any independent-review checkpoint.
Audit findings and review state may still block completion. Leave the spec `in
progress`, `verification failed`, or `verification incomplete` on any stop that
lacks complete verification evidence.

For pure library or CLI work, build plus tests and representative command output
may be enough. Be explicit about the evidence used.

## Step 6 - configured quality audit and repair

Apply `qualityGates.regular.independentReview` before a same-session audit:

- `manual` skips automatic independent review unless a request already exists.
- `when-sensitive` requires it for authentication, authorization, payments,
  secrets, personal or user data, migrations, destructive operations, external
  side effects, security boundaries, or unusually broad changes.
- `always` requires it for every work item.

The selected review runs after all implementation steps, final Verify, required
Check, and the verified spec, before the final review packet and `/complete`.
`review.independentExecution` chooses the manual fresh-session handoff or an
automatic isolated reviewer; it does not change when the gate is selected.

When selected, do not review the builder's work in this session. Ensure
application code is in an approved clean checkpoint. Include the verified spec
when tracked; an intentionally ignored spec uses Audit's local `Spec snapshot`
contract without changing visibility. Then follow Phase A of
`/audit independent current`. With automatic execution, spawn and wait for the
isolated reviewer, then validate its normal receipt. With manual execution, stop
with the handoff. Autopilot may use its existing configured checkpoint authority
when checkpoint commits are enabled; otherwise show the exact review-checkpoint
candidate and ask before committing. On resume, continue only when a fresh
reviewer wrote a current `passed` receipt. Repair `changes-requested` P0/P1
findings within the normal scope and attempt limit, then obtain a new checkpoint
and prepare a new review. A passing independent receipt satisfies the configured
Audit gate. A local-spec-only revision may reuse the same approved product HEAD
after normal spec and verification gates, with a new snapshot/request and full
fresh review. Do not create an empty commit for ignored spec changes. Automatic
execution must also confirm access to the same local spec/snapshot and installed
skills; otherwise retain the request and use the manual handoff in the original
checkout.

The request records `Requested execution`; the receipt records `Actual
execution`. Require the execution and reviewer-context pairing defined by the
project-local review contract, including actual manual plus `fresh session` when
an automatic request explicitly falls back.
On resume, a pending request without `Requested execution` is legacy manual-only.
Never add execution fields or run a subagent against it.

Apply `qualityGates.regular.audit`:

- `manual` - skip the automatic audit; `/audit` remains available when
  explicitly requested.
- `when-sensitive` - run `/audit current` for authentication, authorization,
  payments, secrets, personal or user data, migrations, destructive operations,
  external side effects, security boundaries, or unusually broad changes.
- `always` - run `/audit current` for every work item.

When the gate runs, audit the active feature, its diff, and the nearby code
affected by the change. This is a targeted feature audit, not a repository-wide
cleanup pass. Findings are recorded in `blueprint/context/findings.md` with
durable IDs and statuses, as `/audit` defines; the ledger reports status and
never scopes what the audit examines.

For every finding:

1. Validate it against the actual code, spec, tests, `coding-standards.md`, and
   local project patterns. An audit finding is evidence to investigate, not an
   automatic instruction to edit.
2. Repair confirmed P0 and P1 findings when the fix stays inside the approved
   feature scope, does not require a product or architecture decision, and does
   not remove or change shipped behavior. Set the repaired finding to `fixed` in
   the ledger, never `closed`.
3. Report P2 and P3 findings in the final packet. Fix them only when the change
   is small, directly caused by the current feature, and clearly required by the
   project standards.
4. If a confirmed P0 or P1 finding cannot be repaired safely within scope, stop
   and report it. Do not present the feature as ready for `/complete`.

After any audit repair:

1. Rerun the documented `Verify` command when present; otherwise rerun the
   affected build, lint, typecheck, and test commands.
2. Rerun the acceptance evidence affected by the repair.
3. Recheck the repaired area using the same targeted audit criteria. When that
   recheck confirms the original defect is gone and the repair introduced no
   new one, move the `fixed` finding to `closed` under the `/audit` close
   conditions and name it in the packet. An unrelated new finding gets its own
   ledger entry and does not keep the repaired one open.
4. Create a checkpoint commit only after the repair and its checks pass, and
   only when checkpoint commits are enabled.

Use the existing two-attempt hard stop for repeated repair failures. Do not widen
the feature into a general refactor, silently suppress a finding, or turn this
step into a full-project hardening pass. A broader cleanup remains a separate
`/audit` followed by planned `/fix` work.

## Step 7 - configured try guide

Apply `qualityGates.regular.tryGuide`:

- `manual` - skip automatic generation; `/check guide` remains available when
  explicitly requested.
- `when-user-facing` - run `/check guide` when the change affects UI,
  navigation, copy, a public API or CLI, output, or another workflow a person
  directly uses.
- `when-testable` - run `/check guide` after Verify and required Check. Guide
  mode emits `## Try it now` only when it finds a safe, meaningful direct
  observation and otherwise records a skip without inventing instructions.
- `always` - generate a guide for every work item.

The guide is a review artifact, not proof. Never claim the user performed it.

## Step 8 - final review packet

Stop with a concise review packet. Keep it useful enough for `/complete` but not
a full audit report:

- branch name
- target feature or fix
- whether the spec was created or resumed
- what the spec critique changed
- changed files and why each changed
- build/test/check commands run, with pass or fail
- effective regular quality-gate policies and which automatic gates ran or were
  skipped
- independent-review target, selected reviewer and model, and receipt state
- screenshots or output paths, when relevant
- the generated `## Try it now` section when one exists, or the recorded reason
  it was omitted
- checkpoint commits created
- self-review findings
- targeted audit scope and findings, when the audit gate ran
- audit repairs made and checks rerun, when applicable
- P0/P1 findings still `open` or `fixed` in `blueprint/context/findings.md`,
  which block `/complete`
- unresolved risks or skipped checks
- exact next action

If everything is green, the next action is usually: review the diff, run `/check guide`
if its gate was manual and a walkthrough is wanted, then `/complete`.

Always offer a read-only walkthrough of the completed code after the packet.
Follow the spec's build steps, explain the key files, symbols, flow, and
non-obvious decisions, then offer a focused deep dive. Keep `/check guide` distinct as
the manual product-review path.

If something failed, name the failing check and the next fix target.

## Hard Stops

Stop immediately and report instead of continuing when Autopilot would need to:

- commit on `main`, merge, delete a branch, push, deploy, publish, or send
  anything
- delete data, reset a database, run irreversible migrations, kill processes, or
  change system settings
- install dependencies or use network access without the current tool's approval
  flow
- make a product decision not covered by the docs
- continue after two failed fix attempts on the same issue
- hide, skip, or hand-wave a failing check

## Rules

- One Autopilot run handles one feature or one fix.
- Autopilot creates checkpoint commits on the feature or fix branch after
  passing steps only when project config enables them.
- Autopilot uses `qualityGates.regular`. The Continuous gate policies and the
  `continuous` section do not change an Autopilot run.
- When its audit gate runs, Autopilot audits the active feature and affected
  code, not the entire project.
- A P0 or P1 finding left `open` or `fixed` in `blueprint/context/findings.md`
  blocks readiness for `/complete`. The ledger is what makes this enforceable.
- Autopilot stops before `/complete`. It never merges.
- The Blueprint files remain the state machine. Keep
  `current-feature.md` accurate as steps complete.
- Follow `coding-standards.md`, `ai-interaction.md`, and `AGENTS.md`.
- Prefer fewer, higher-quality changes over broad coverage.
- Report uncertainty plainly. A blocked run is useful if it tells the truth.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
