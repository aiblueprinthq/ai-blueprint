# Independent review record

`blueprint/context/review.md` holds one active request or latest receipt for the
current work item. It is generated workflow state, committed when the project's
visibility permits, archived by `/complete`, and then reset.

## Reset stub

```markdown
# Independent Review

> **Generated file.** Holds the active independent-review request or latest
> receipt for the current work item. `/audit independent current` prepares a
> handoff against an approved checkpoint, a fresh reviewer context completes it,
> and `/complete` refuses stale, pending, or changes-requested review state.

_No independent review requested. Run `/audit independent current` to prepare one._
```

## Pending request

Use full commit SHAs, the exact permitted base ref used to calculate the merge base,
a lowercase SHA-256 hash of the exact
`blueprint/context/current-feature.md` bytes, an ISO-8601 timestamp, and one of
`codex`, `claude`, `copilot`, `opencode`, or `antigravity` for each adapter field.
Model fields use the full identifier exposed by runtime or session metadata,
not a generic family label. When unavailable, record
`unknown (runtime did not expose exact model)` instead of guessing. When the
review runtime cannot select a specific model before the session starts, use
`runtime default (exact model not known until reviewer starts)` for Requested
model and record the exact runtime model in the completed receipt.

A pending request without `Requested execution` is a legacy manual request.
Never auto-upgrade it or send it to a subagent. Complete it only from a fresh
reviewer session, keep `Reviewer context: fresh session`, and omit `Actual
execution` so both execution fields remain absent.

```markdown
# Independent Review

**Status:** pending
**Target commit:** <full 40-character checkpoint SHA>
**Base commit:** <full 40-character merge-base SHA>
**Base ref:** <local branch or remote-tracking ref used for the merge base>
**Spec hash:** <64-character SHA-256>
**Prepared by:** <adapter>
**Builder model:** <exact model reported by the builder runtime>
**Requested reviewer:** <adapter>
**Requested model:** <exact model or user-selected runtime default>
**Requested execution:** <manual or automatic>
**Requested at:** <ISO-8601 timestamp>
**Workflow:** <regular or continuous>
**Check required:** <yes or no>

## Handoff

Review the active spec and the complete `<base>..<target>` delta in a fresh
session or isolated subagent without the builder conversation. Run all Audit lenses from scratch.
Run Check when required above. Do not edit product code, accept findings, or
reuse the existing findings as the review scope.
```

For an independently enforceable receipt, `Base ref` must be a locally recorded
remote default branch, local `main`, or local `master`. It cannot be the current
work branch, and `Base commit` cannot equal `Target commit`. If none of those
base refs reliably covers the active work, stop instead of creating a receipt
whose review range cannot be re-derived.

## Local spec snapshot

For a new request whose verified spec is intentionally ignored, keep application
code in the approved checkpoint and freeze the spec outside Git. Add exactly one
field after `Spec hash`, using a plain path with no backticks:

```markdown
**Spec snapshot:** blueprint/.state/review-specs/<Target commit>-<Spec hash>.md
```

Substitute the request's full lowercase target SHA and lowercase spec hash. This
is the only permitted snapshot path; duplicate fields or another path are
malformed. Tracked-spec requests do not need this field. Existing requests and
receipts without it retain their previous hash, freshness, and execution rules.
Never retroactively add `Spec snapshot` to a pending or completed record.

Phase A prepares the copy before publishing a new pending request:

1. Read the verified active spec as raw bytes and calculate its SHA-256 without
   decoding, trimming, or normalizing line endings. Use that digest as `Spec hash`.
2. Use `lstat` on the selected project root and every directory below it leading
   to the spec and snapshot. Require ordinary directories, a regular spec file,
   and a regular file for any existing snapshot. Reject symbolic links, including
   dangling links. Ancestor aliases above the selected root are not inspected.
   Create missing snapshot directories only beneath verified ordinary parents;
   a missing snapshot leaf is allowed only for exclusive creation below them.
3. Require both paths to be ignored and untracked, absent from the index and
   `Target commit`. Check ignore status separately for each path, require no
   entries from `git ls-files --stage -- <spec-path> <snapshot-path>` or
   `git ls-tree -r --name-only <target> -- <spec-path> <snapshot-path>`, and
   distinguish expected absence from Git failure. Never force-add files or
   change ignore visibility to make these checks pass.
4. Create the snapshot exclusively, for example with Node's `fs.open` using
   `wx`, then write the raw byte buffer and close the handle. If it already
   exists, reuse only an ordinary file whose bytes exactly match the spec.
   Conflicting bytes, unsafe paths, or a failed write stop preparation; never
   overwrite or repair the existing snapshot in place.
5. Read both files back and require identical raw bytes and the recorded hash.
   Recheck their path and Git conditions before writing the request. Keep the
   snapshot unchanged through review and completion; do not automatically delete
   or regenerate it to make an existing receipt pass.

The target/base fields bind application code; `Spec hash` binds both local files.
The snapshot is an input, never another allowed dirty Git path. Manual handoff
names the original checkout, target/base SHAs, snapshot path, and hash. An
automatic child must be able to read those same ignored inputs and installed
project-local skills. If that access cannot be confirmed, retain the request and
use the manual fresh-session handoff in the original checkout. Do not copy local
inputs externally or substitute a clone/worktree that lacks them.

## Completed receipt

Keep the request fields unchanged and replace `pending` with `passed` or
`changes-requested`. Add these fields and sections:

```markdown
**Reviewer adapter:** <adapter>
**Reviewer model:** <exact model reported by the reviewer runtime>
**Reviewer context:** <fresh session or fresh subagent>
**Actual execution:** <manual or automatic>
**Reviewed at:** <ISO-8601 timestamp>
**Scope:** current
**Lenses:** quality, security, performance, tests
**Verdict:** <passed or changes-requested>
**Check result:** <passed, failed, unavailable, or not-required>

## Commands

- `<command>`: <pass, fail, or unavailable>

## Evidence

- <safe concise evidence reference>

## Findings

- <finding IDs, or `None`>

## Remaining risk

- <risk or unavailable signal, or `None identified`>
```

Every unavailable verification command must appear under Remaining risk, even
when Check was not required and the receipt may still pass.

All four completed-receipt sections must contain at least one entry. Use
`- None`, `- None identified`, or `- No commands run` when that is the truthful
result. When Check is required, `Check result` must be `passed` before the
receipt can pass. Use `not-required` only when Check was not required.

Use `passed` only when all four lenses covered the complete target delta, every
required check passed, and no P0 or P1 finding is `open` or `fixed`.
P2 and P3 findings may remain with their normal ledger status. Use
`changes-requested` for a blocking finding, failed required check, incomplete
scope, adapter mismatch, or missing a valid fresh-context declaration.

Execution and context must agree. A manual request completes only as actual
`manual` with `fresh session`. An automatic request normally completes as
actual `automatic` with `fresh subagent`; when automatic capability falls back,
it may complete as actual `manual` with `fresh session`. Reject every other
pairing. Legacy receipts with neither execution field remain valid only with
`fresh session`; a legacy receipt can never claim `fresh subagent`.

## Freshness

A receipt is current only when all of these hold:

- `HEAD` exactly equals `Target commit`.
- `Base ref` still resolves and its merge base with `Target commit` exactly
  equals `Base commit`, and it remains a locally recorded remote default branch,
  local `main`, or local `master`.
- The exact current-feature bytes still match `Spec hash`.
- When `Spec snapshot` is present, both raw files match that hash and every
  snapshot path, visibility, and Git condition above still holds. Missing or
  changed snapshot inputs make the record stale; Git failure never passes.
- No tracked, staged, unstaged, or untracked path differs from the target except
  `blueprint/context/review.md` and `blueprint/context/findings.md`.
- The completed reviewer adapter matches `Requested reviewer`.
- The completed reviewer model exactly matches `Requested model`, unless the
  request explicitly selected the runtime-default sentinel above. In that case,
  `Reviewer model` must still contain the exact model exposed after the reviewer
  session starts, never the sentinel itself.
- `Reviewer context` is exactly `fresh session` or `fresh subagent`. A subagent
  receipt is valid only when the runtime started it without the builder
  transcript and exposed its exact adapter and model. The automatic child is a
  generic current-runtime child instructed from the project-local Audit skill
  and this project-local contract. It never depends on a global role, skill,
  prompt, or another workflow.
- `Requested execution` and `Actual execution` form one of the allowed pairings
  above. New requests always record the requested value, and new receipts always
  record the actual value.

Any other code, test, configuration, spec, or acceptance-criteria change makes
the receipt stale. A stale receipt never proves the new state. Product changes
need a new approved checkpoint. A local-spec-only revision may reuse the same
approved product HEAD after normal spec and verification gates, with a new
snapshot, a new request, and a full fresh review. Never create an empty commit
just to capture ignored spec changes or edit a passed receipt into a new review.

The adapter, model, and context fields are declared metadata. Blueprint proves
the target and staleness, but it cannot cryptographically prove that a separate
agent or fresh context performed the review.

## Phase A - prepare the handoff

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
   the exact local `Spec snapshot` under the contract above. Never force-add
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
   above. Never add that field to an existing pending or completed
   record. Write the pending template exactly. Copy the full model identifier
   exposed by the active runtime or session metadata (for example,
   `gpt-5.6-sol`), never a generic family label
   such as `GPT-5`. If the runtime does not expose an exact identifier, record
   `unknown (runtime did not expose exact model)` instead of guessing. When the
   reviewer runtime cannot select a specific model before opening the session,
   record the exact runtime-default sentinel from the contract above.
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

## Phase B - perform the review

Use this phase when a current pending request exists.

1. Confirm the current adapter matches `Requested reviewer`, the current model
   matches `Requested model` unless the runtime-default sentinel was selected,
   and a sentinel request now records the exact model exposed by the session,
   `HEAD` matches `Target commit`, the recorded base ref still produces the
   recorded merge base, the exact spec hash matches, and no path differs from
   the target except `blueprint/context/review.md` and
   `blueprint/context/findings.md`. When `Spec snapshot` is present, verify both
   raw spec/snapshot hashes and every path, visibility, and Git condition above.
   Stop on any mismatch or stale state.
2. Proceed only from the fresh reviewer handoff. Record `fresh session` for a
   manual reviewer or `fresh subagent` for an automatic isolated reviewer. This
   is a declaration, never cryptographic proof. If the reviewer has the builder
   conversation or is the builder continuing in place, stop and request a fresh
   context. For a legacy request with no `Requested execution`, require a fresh
   reviewer session, record `fresh session`, and omit `Actual execution`.
3. Run Audit Steps 1 through 3 across `current` with quality, security,
   performance, and tests together. Review the code fresh against the recorded
   `Base commit` and `Target commit`; exclude the request and findings files
   from the code scope. Existing findings are context, never the review
   checklist.
4. Run `/check` from the reviewer session when the request says Check is
   required. Follow Check's server and evidence boundaries. A required check
   that cannot run prevents a passing receipt.
5. Update the findings ledger through Audit Step 4, then replace the pending
   request with a completed receipt. Use `passed` only when the whole target was
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
