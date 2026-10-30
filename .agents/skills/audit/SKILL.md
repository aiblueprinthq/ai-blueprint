---
name: audit
description: Audit current changes, a path, or the full project for quality, security, performance, or test problems and record durable findings. Independent mode prepares or completes a fresh-reviewer checkpoint handoff. Use for /audit, independent review, security review, code quality review, dead code, duplication, or standards drift.
---

# audit - review code quality against the project standards

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

    /implement or /autopilot  ->  [audit]  ->  fixes or /complete
    (code exists)                 (review +    (repair quality issues
                                   ledger)      or close the feature)

`/check` proves behavior against the spec. `/doctor` checks Blueprint setup and
workflow health. This skill checks the code itself through either a broad review
or one focused lens: quality, security, performance, or tests.

It reviews code without changing it: it never edits source files, installs
dependencies, commits, merges, pushes, or starts product work. A normal audit's
one write is the findings ledger at `blueprint/context/findings.md` (Step 4),
the durable record of findings and their status. Independent mode may also
write `blueprint/context/review.md` using the exact record contract in
`reference/independent-review.md`.

The quality-gate config controls when another workflow invokes this skill
automatically. An explicit `/audit` or `$audit` request always selects the audit
regardless of whether the applicable gate is `manual`, conditional, or `always`.
A selected `independentReview` gate invokes independent mode instead of letting
the builder satisfy its own review. When both audit and independent review are
selected, one passing independent review satisfies the audit gate.
A missing config means built-in defaults. If it exists but is invalid, stop and
point to `/doctor` before writing the findings ledger.

## Input

Treat scope and lens as separate controls. Arguments may appear in either order,
such as `/audit security current` or `/audit src/auth tests`.

Optional scope:

- no scope argument: use `current` when an active feature exists, otherwise use
  `changed` when local changes exist, otherwise use `full`
- `current`: audit the active `current-feature.md`, every committed feature-branch
  change from its merge base through `HEAD`, staged and unstaged changes,
  untracked source files, and nearby code affected by the feature
- `changed`: audit staged, unstaged, and untracked source files plus nearby code
- `full`: audit all project-owned source, tests, and configuration while excluding
  dependencies, generated files, build output, coverage output, caches, vendored
  code, and minified assets unless the user explicitly includes them
- path or directory: audit that area and the tests or callers needed to understand it

Optional lens:

- no lens: review all four lenses
- `quality`: maintainability, duplication, dead code, consistency, complexity,
  and standards drift
- `security`: authorization, input trust, injection, data exposure, secret
  handling, and unsafe configuration
- `performance`: query, network, rendering, memory, payload, concurrency, and
  unbounded-work risks
- `tests`: missing coverage for important logic, weak assertions, skipped or
  focused tests, poor isolation, brittle mocks, and likely flakiness

`full` is always the full-project scope, not a lens. `/audit full` therefore runs
all lenses across the full project. When only a lens is supplied, select scope
with the normal no-scope rules. A focused pass may name one or more lenses. If
the request names multiple lenses, review their union and report them separately.

If the requested scope is unclear, pick the smallest useful scope and state it.
If the lens is unclear, use all lenses and state that choice.

Optional review mode:

- `independent`: prepare or complete an independent review of `current` across
  all four lenses. It cannot be combined with `changed`, `full`, a path scope,
  or a focused lens because a completion receipt must cover the whole active
  work item.

## Independent mode

`/audit independent current` is a two-context workflow. The builder prepares a
request. With `review.independentExecution: "manual"`, the selected fresh
reviewer session runs the same command to complete it. With `automatic`, the
current adapter may start a fresh isolated reviewer subagent after preparing the
request. Blueprint verifies the exact target and later staleness. The adapter,
model, and fresh-context identity remain declared metadata.
An explicit invocation uses this execution setting even when the active
workflow's `independentReview` gate is `manual`; that gate value disables only
automatic selection by the workflow.

Read `reference/independent-review.md` before either phase.

### Phase A - prepare the handoff

Use this phase when `blueprint/context/review.md` has no current `pending`
request for `HEAD` and the current spec hash.

A current pending request without `Requested execution` is legacy and manual
only. Never add execution fields to it or run a subagent against it. Stop with
the fresh-session handoff; Phase B must omit `Actual execution` so the legacy
request and receipt keep both execution fields absent.

1. Require an active spec with every build step checked and status `verified`, a
   non-default work branch, a reliable merge base, and a working tree matching
   the target except existing `blueprint/context/review.md` and
   `blueprint/context/findings.md` evidence.
   Independent mode accepts only a locally recorded remote default branch,
   local `main`, or local `master` as its enforceable base ref. Stop when none
   reliably covers the active work.
   The current full `HEAD` must be the approved application-code checkpoint.
   Include the verified spec when tracked; for a new ignored-spec request, prepare
   the exact local `Spec snapshot` under the reference contract. Never force-add
   it or change ignore visibility. Never create a commit inside Audit. If any
   tracked, staged, unstaged, or untracked path other than those two evidence
   paths differs from the target, stop and ask the user to approve a review
   checkpoint through `/implement`, even when normal checkpoint commits are
   disabled. Do not create a checkpoint solely for review/findings changes.
   This normal Phase A exception never allows snapshot Git differences or
   overwriting conflicting completion-recovery evidence.
2. Read installed adapters from `blueprint/.state/manifest.json` when valid.
   For older installs, detect `.agents/skills` as `codex` and `.claude/skills`
   as `claude`. These files prove project support, not that the external runtime
   is installed or authenticated.
3. Resolve the review executor from `review.independentExecution`:
   - For `manual`, ask which detected adapter and available model should review.
     Recommend an equal-or-stronger coding model, a different model family when
     practical, and high reasoning for sensitive work. Offer a fresh session in
     the current adapter as the fallback. Do not invent available models or
     offer an adapter that is not installed in the project.
   - For `automatic`, use only a live child-agent capability in the current
     adapter that can start with no builder transcript, disclose the exact
     reviewer adapter and model, and wait for completion. Spawn a generic fresh
     isolated child through the current runtime. Do not discover, select, or
     depend on a globally installed role, skill, prompt, or another workflow
     such as TraversyFlow. If the runtime cannot start that generic child from
     project-local instructions, or capability, isolation, identity, model,
     completion, or access to the same ignored spec/snapshot inputs cannot be
     confirmed, use the manual path in the original checkout.
4. Record the full target SHA, full merge-base SHA, the exact local base ref
   used to calculate it, exact spec SHA-256, current adapter and model,
   requested reviewer adapter and model, requested execution from
   `review.independentExecution`, workflow, and
   whether the configured Check gate is required. For a new ignored-spec request,
   create or reuse the exact snapshot first and record `Spec snapshot` as defined
   in the reference. Never add that field to an existing pending or completed
   record. Write the pending template exactly. Copy the full model identifier
   exposed by the active runtime or session metadata (for example,
   `gpt-5.6-sol`), never a generic family label
   such as `GPT-5`. If the runtime does not expose an exact identifier, record
   `unknown (runtime did not expose exact model)` instead of guessing. When the
   reviewer runtime cannot select a specific model before opening the session,
   record the exact runtime-default sentinel from the reference contract.
5. Execute the configured path:
   - For `manual`, set dashboard activity to `ready` and give the exact handoff
     command for the selected adapter. Claude Code and Google Antigravity use
     `/audit independent current`; Codex uses `$audit independent current`;
     Copilot and OpenCode receive the equivalent plain-language instruction.
     Tell the user to open a fresh session in the original checkout with only the
     handoff, not the builder chat. Include target/base SHAs and, when present,
     the exact snapshot path and spec hash.
   - For `automatic`, freeze all parent product, test, spec, and config changes.
     Start one generic isolated child without the builder transcript. Instruct
     it to read the project-local Audit skill and
     `audit/reference/independent-review.md` from the current adapter tree, then
     execute Phase B using the same local spec/snapshot inputs against the
     prepared request. All review instructions come
     from that installed Blueprint project. The reviewer may write only
     `blueprint/context/findings.md` and `blueprint/context/review.md`; it must
     not repair code, change the spec, commit, or perform external actions. Wait
     for completion, then reread and validate the normal receipt before
     continuing. Record `fresh subagent` as its reviewer context.

If automatic execution fails or any required property becomes uncertain, keep
the pending request intact, set activity to `ready`, and stop with the existing
manual fresh-session handoff. Never let the builder review its own work or skip
a selected independent-review gate.

The builder never performs Phase B itself. It may continue only after a manual
reviewer session or automatic isolated reviewer produced a valid current receipt.

### Phase B - perform the review

Use this phase when a current pending request exists.

1. Confirm the current adapter matches `Requested reviewer`, the current model
   matches `Requested model` unless the runtime-default sentinel was selected,
   and a sentinel request now records the exact model exposed by the session,
   `HEAD` matches `Target commit`, the recorded base ref still produces the
   recorded merge base, the exact spec hash matches, and no path differs from
   the target except `blueprint/context/review.md` and
   `blueprint/context/findings.md`. When `Spec snapshot` is present, verify both
   raw spec/snapshot hashes and every path, visibility, and Git condition in the
   reference. Stop on any mismatch or stale state.
2. Proceed only from the fresh reviewer handoff. Record `fresh session` for a
   manual reviewer or `fresh subagent` for an automatic isolated reviewer. This
   is a declaration, never cryptographic proof. If the reviewer has the builder
   conversation or is the builder continuing in place, stop and request a fresh
   context. For a legacy request with no `Requested execution`, require a fresh
   reviewer session, record `fresh session`, and omit `Actual execution`.
3. Run Steps 1 through 3 across `current` with quality, security, performance,
   and tests together. Review the code fresh against the recorded
   `Base commit` and `Target commit`; exclude the request and findings files
   from the code scope. Existing findings are context, never the review
   checklist.
4. Run `/check` from the reviewer session when the request says Check is
   required. Follow Check's server and evidence boundaries. A required check
   that cannot run prevents a passing receipt.
5. Update the findings ledger through Step 4, then replace the pending request
   with a completed receipt. Use `passed` only when the whole target was
   reviewed, required checks passed, and no P0 or P1 finding is `open` or
   `fixed`. Copy the reviewer's full runtime model identifier using the same
   rule as Phase A. Record `Check result` and keep all four receipt sections
   non-empty, using an explicit `None` entry when appropriate. List every
   unavailable verification command under Remaining risk, even when Check was
   not required and the receipt may still pass. Otherwise use
   `changes-requested` and name the exact blockers. Record actual `automatic`
   with `fresh subagent`, or actual `manual` with `fresh session`, including an
   explicit manual fallback from an automatic request.
6. Report the receipt target, reviewer adapter and model, commands, evidence,
   findings, remaining risk, and whether the receipt passed. Never repair code
   from the reviewer session.

After changes are requested, the builder repairs through `/implement`, obtains
approval for a new checkpoint, and prepares a new request. The next reviewer
pass reviews the complete new delta, not only the old findings.
A local-spec-only revision may reuse the same approved product HEAD after normal
spec and verification gates, with a new snapshot/request and full fresh review;
it never requires an empty commit.

## Step 1 - gather context

Resolve this required context:

- `AGENTS.md`
- `blueprint/config.json`
- `blueprint/context/project-overview.md`
- `blueprint/context/coding-standards.md`
- `blueprint/context/current-feature.md`
- `blueprint/context/findings.md`, for existing IDs and statuses
- `blueprint/context/review.md`, for independent request and receipt state
- `blueprint/context/ai-interaction.md`
- `blueprint/build-plan.md`, when feature order matters
- git branch and working tree status
- relevant source files, tests, and configs for the chosen scope

For `current`, `changed`, and path scopes, begin with the diff or named area and
follow only the callers, dependencies, tests, and contracts needed to verify a
reachable finding. Do not survey unrelated directories. For `full`, preserve the
declared exclusions and inspect by bounded area rather than dumping the project
into one response.

For `current`, resolve the comparison base without network access:

1. Use a base branch declared by the active spec or project instructions.
2. Otherwise use the locally recorded remote default branch when available.
3. Otherwise use an existing local `main`, then `master`.
4. Find the merge base and inspect the committed delta through `HEAD`, then add
   staged, unstaged, and untracked work.
5. If no reliable base exists, say so and use the active spec plus local changes.
   Never claim that committed feature work was fully covered in that case.

Do not fetch or pull to discover the base. For `full`, state the excluded paths
before reviewing so generated or third-party code does not consume the audit.

Prefer `rg` and targeted file reads. Do not dump large files into the response.

## Step 2 - run available signals

Use existing commands only. Do not install tools.

Run or inspect only the signals relevant to the selected lens and scope:

- lint and typecheck commands when declared and relevant
- test command for the tests lens or when it directly validates a suspected risk
- build command when the selected lens needs compilation or bundle evidence
- existing security command for the security lens, when declared and locally runnable
- existing performance command for the performance lens, when declared and locally runnable
- targeted lightweight searches for the chosen lens, such as unused exports and
  copied logic for quality, unsafe trust boundaries for security, repeated or
  unbounded work for performance, and skipped or weak tests for tests

Do not run broad checks unrelated to a focused lens. If a useful command is
missing, report that as a gap. Do not invent a pass or claim that a focused
review covered the other lenses.

## Step 3 - review the code

For all lenses, ground findings in reachable code and project-specific
expectations. Apply only the selected lens or lenses:

- **Quality:** duplicated logic, dead or unused code, unreachable paths,
  oversized modules, abstractions that do not pay for themselves, risky missing
  abstractions, speculative dependencies, services, configuration surfaces,
  compatibility layers or security machinery, inconsistent patterns, and drift
  from the standards or spec. Untuned stack-specific template defaults are not
  established requirements.
- **Security:** missing authentication or authorization, client-controlled
  ownership, injection, unsafe parsing or deserialization, sensitive-data
  exposure, secret handling, insecure defaults, and trust-boundary mistakes.
  Inspect existing dependency or scanner output when available, but never imply
  that local manifest inspection is a current vulnerability scan.
- **Performance:** N+1 queries, repeated network or database work, unnecessary
  rendering, blocking work on hot paths, unbounded loops or collections, memory
  growth, oversized payloads, missing pagination, and unsafe concurrency. Mark
  hypotheses as unverified when runtime or profiling evidence is missing.
- **Tests:** important logic without coverage when a test command exists, weak
  assertions, tests that only mirror implementation, excessive mocking, shared
  state, time or order dependence, skipped or focused tests, placeholder tests,
  swallowed failures, and missing browser or integration evidence where behavior
  crosses a real boundary. Never invent a coverage percentage.

Do not nitpick harmless style differences unless they signal drift from the local
patterns. Prefer a short list of real findings over a broad list of guesses.

For a proportionality finding, state in **Suggested fix** what can be deleted,
which existing, standard-library, native-platform, or installed mechanism
replaces it, and which current requirement would be lost. Use `None` when no
current requirement would be lost. If the suggested fix removes or changes
shipped behavior, require an explicit user decision and never describe it as an
automatic repair.

Do not broaden a focused pass because another category might be interesting.
Do not report or call out non-critical concerns from omitted lenses, even as
suggestions for a later audit. If an obvious P0 is directly encountered outside
the selected lens, report and record it as an out-of-lens critical risk, but do
not continue searching that other lens.

If a possible secret is found, never quote its value, paste the matching source
line, or include raw command output containing it. Report only the redacted secret
category, file, line, risk, and remediation. Redact sensitive values from all
audit evidence before responding.

## Step 4 - update the findings ledger

`blueprint/context/findings.md` is the durable record of findings. Chat reports
do not survive a context clear; the ledger does. It is the only file this skill
writes. If it is missing (an older install), create it with a `# Findings`
heading first.

**The ledger never scopes the review.** Review the code fresh in Step 3, then
record what the review found. Working from the open findings as a checklist and
verifying only those is the exact failure this file exists to prevent: a repair
can introduce a new defect that no existing entry points at.

One block per finding. The header line is the machine-readable contract and must
keep this exact shape; the prose below it is for humans and may vary:

    ### F-03 [P0] open - Retained auth volumes carry the run label

    **File:** ops/agent-proof/compose.yaml:86
    **Found:** 2026-07-21 by /audit (scope: current; lens: security)
    **Why it matters:** ...
    **Suggested fix:** ...
    **Resolution:**

IDs are sequential within the ledger (`F-01`, `F-02`, ...), never reused and
never renumbered while their entries live here, even after a finding closes.
Bare IDs are scoped to the live ledger: `/complete` archives resolved entries
under a work-item prefix (feature 12's first `F-03` becomes `12/F-03`, and its
second build's becomes `12-build-2/F-03`). The build attempt comes from the verified
spec/history proof, not arbitrary filename text; fix and rollback prefixes stay
their archive filenames. That prefixed form is the permanent reference. A later
ledger that has emptied and reset starts at `F-01` again without colliding. Severity reuses the P0-P3
scheme from Step 5; only P0 and P1 block `/complete`. Status is one of:

| Status | Meaning | Blocks P0/P1 at /complete |
|---|---|---|
| `unverified` | Suspected, no confirming evidence yet | No |
| `open` | Confirmed, not yet repaired | Yes |
| `fixed` | Repaired, not yet re-reviewed | Yes |
| `closed` | Repaired and re-reviewed against the new code | No |
| `accepted` | Not fixing, by the user's explicit decision; reason recorded in Resolution | No |
| `invalid` | Re-examination proved the finding wrong; evidence recorded in Resolution | No |

After the review:

- Append each new confirmed finding as `open` with the next sequential ID, one
  past the highest ID present in the ledger (entries carried forward from
  earlier work count; a fresh ledger starts at `F-01`).
- Record an unverified risk worth tracking as `unverified`. It is a lead, not a
  defect, and never gates a merge.
- Update the entries this pass re-examined: correct the status or severity and
  note the evidence in **Resolution**.
- Move a `fixed` finding to `closed` only when all three hold: this pass's
  reviewed set included the finding's file, re-examining the repaired code
  confirmed the original defect is gone and the repair introduced no new one,
  and the report names the finding as closed. An unrelated new finding in the
  same file gets its own entry and does not keep the repaired one open. Never
  close a finding implicitly.
- Set `accepted` only on the user's explicit decision in the current session,
  and record their reason. Never accept a finding on their behalf.
- Set `invalid` only when re-examination shows the finding was wrong, and
  record that evidence in **Resolution**. It is a review verdict (or the
  user's explicit call), never a shortcut past the gate for blocked work.

`fixed` blocking `/complete` is deliberate: a repair is not done when the code
changes, it is done when a review has looked at the result. `/implement` marks
repairs `fixed`; only a review pass moves them to `closed`.

## Step 5 - report findings

Lead with findings, ordered by severity, using the IDs the ledger assigned:

    F-04 [P1] Title
    File: path:line
    Why it matters: ...
    Suggested fix: ...

Severity:

- `P0` - data loss, security break, or code that cannot ship
- `P1` - likely bug, broken contract, missing guard, or high-risk duplication
- `P2` - maintainability issue worth fixing before the feature closes
- `P3` - small cleanup, consistency issue, or follow-up candidate

Use P0 or P1 only when a concrete code path, violated contract or security
boundary, failing command or test, or reproducible behavior confirms the risk. If
the evidence is incomplete, list it under `Unverified risks` with the missing
validation instead of presenting it as a confirmed high-severity finding.
An otherwise pure proportionality finding is P2 or P3. Raise it to P0 or P1 only
when the unnecessary machinery causes a concrete reachable defect or violates an
established security or data-integrity boundary.

If there are no findings, say that clearly for the selected lens and name any
remaining risk or missing signal, such as "no test command declared" or
"browser flow not audited."

Then include:

- ledger changes: findings added, updated, or closed this pass, by ID
- commands run and results
- selected scope
- selected lens or lenses
- base branch, merge base, and commit range for `current`, when available
- files or directories reviewed
- generated, third-party, or otherwise excluded paths
- applicable standards checked
- browser or runtime evidence inspected, when relevant
- skipped, focused, or placeholder tests found, when the tests lens was selected
- checks that were unavailable or could not run
- suggested repair order
- independent receipt status and target, when independent mode ran

For `full`, say whether coverage was complete or partial. Never label a partial
review as a full-project audit.

## Rules

- A normal audit writes only the findings ledger. Independent Phase A may also
  create the exact local spec snapshot and pending request. Phase B may write
  only `blueprint/context/findings.md` and `blueprint/context/review.md`.
  Never edit, format, install, commit, merge, push, or delete anything else.
- Never let a builder complete its own independent request in the same session.
- Never silently substitute another reviewer adapter or model.
- A stale receipt is no receipt. Re-review the complete new checkpoint.
- A focused lens is not a broad audit. State what was not reviewed and never
  imply that omitted lenses passed.
- The ledger reports status; it never defines what the review looks at. Do not
  turn open findings into the review checklist.
- Never fetch, pull, or run network-backed audit tools without explicit approval.
- Never reproduce secrets or sensitive values in findings or command output.
- Findings first. Keep summaries short.
- Ground every finding in a file path and line number when possible.
- Avoid speculative rewrites. Recommend the smallest fix that removes the risk.
- Respect existing project patterns over generic advice.
- Do not require perfection. The goal is code that is understandable, consistent,
  testable where it matters, and safe to keep building on.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
