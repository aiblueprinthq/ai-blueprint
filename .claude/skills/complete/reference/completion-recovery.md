# Completion recovery

Use this contract before Complete requires a live spec, and before Status or
Continuous selects new work. Archive and Git evidence determine the phase.
`run.json`, modification times, archive titles, and commit subjects prove none of
these transitions. Recovery grants no commit, merge, push, or cleanup approval.

## Prepare one recoverable archive

After Complete's final gates pass, but before any logging edits, record the full
work branch ref, `HEAD`, local default branch ref, and configured `git.landing`.
For `local-merge`, record the current local default commit as `baseCommit` and
require it to be an ancestor of the work branch. For `pull-request`, record the
merge base of the work branch and local default as `baseCommit`; require it to be
an ancestor of both refs. Resolve refs locally and do not fetch during this
capture. Capture the verified working tree in a temporary Git index:

```bash
node --input-type=module -e '
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-completion-"));
const env = { ...process.env, GIT_INDEX_FILE: path.join(dir, "index") };
try {
  execFileSync("git", ["read-tree", "HEAD"], { env });
  execFileSync("git", ["add", "-A", "--", "."], { env });
  process.stdout.write(execFileSync("git", ["write-tree"], { env }));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}'
```

Run from the project root only after excluding unrelated work and Git conflicts.
This writes local Git objects, not a commit or ref, and leaves the normal index
untouched. Never force-add ignored files. Dirty submodules or required ignored
inputs without separately recoverable exact bytes cannot support this proof.
The source tree is evidence, not approval or a substitute for any quality gate.

Before logging, record `absentOptional` as an array containing only
`blueprint/context/findings.md` and/or `blueprint/context/review.md` when each
exact path returns `ENOENT` from `lstat`, its parents are ordinary directories,
and neither HEAD nor sourceTree contains it. Otherwise omit that path. This
records original filesystem absence, never permission to discard evidence.
Ignored existing files and symlinks are not absent. Reject other paths, duplicates,
or contradictions; a missing field in an older annotation proves no absence.

Start the archive with the original verified spec bytes, unchanged. Measure
UTF-8 **bytes**, not characters or lines. Append two LF bytes and this single-line
JSON comment before any Findings, Independent review, or Manual try guide section:

```text
<!-- blueprint:completion {"schemaVersion":2,"specBytes":123,"specSha256":"<64 hex>","branch":"refs/heads/feature/name","head":"<full SHA>","baseRef":"refs/heads/main","baseCommit":"<full SHA>","sourceTree":"<full tree SHA>","landing":"local-merge","absentOptional":[]} -->
```

Schema 1 annotations remain valid legacy `local-merge` records. Schema 2 requires
`landing` to be exactly `local-merge` or `pull-request`. Reject unknown versions,
missing schema 2 landing values, or values that disagree with the active
completion path.

Use `Buffer.length` and SHA-256 over the exact file bytes. To recover, locate the
unique annotation boundary and remove only the two inserted line breaks before
it (LF or CRLF). Test that prefix as raw bytes and uniform LF/CRLF candidates
against both `specBytes` and `specSha256`; deduplicate identical candidates and
accept only one exact match. This reconstructs hash-proven original bytes across
ordinary Git EOL conversion. Mixed endings or custom filters without an exact
match stop recovery. Never trim content, split on a Markdown heading, or accept a
normalized digest instead of the original. Reject malformed/duplicate annotations.

Build the complete archive in a temporary file first, including all resolved
findings, the exact passing receipt when present, and any generated try guide.
Validate it against its inputs, then place it at the intended absent archive path.
Never overwrite an existing archive: a matching one enters recovery; a conflicting
one stops for an exact path decision. Finish plan/overview bookkeeping, then
remove only the archived findings and reset review. Reset the active spec last.
Do not append sections incrementally to an existing archive during recovery.

## Screen candidates read-only

Before matching a reused feature branch, apply the historical-build exclusion
below. Do not treat a proved prior reversed build as pending completion of its
replacement. If that exclusion cannot be proved, retain the candidate and stop
for full proof rather than guessing from a different spec or archive name.

Inspect current branch, `git status --porcelain=v1`, live spec/review and plan
consistency, and relevant annotated archives. Check recorded local work refs with
`git show-ref --verify --quiet <branch>`. A matching work branch/archive, a retained
matching work ref after merge, or uncommitted completion changes/live evidence tied
to that item is a recovery candidate. An explicit request to resume completion
also requires full proof. Status reports candidates and routes them to Complete;
it does not create a temporary index or claim the phase has passed full proof.

For ordinary Status or a new Continuous invocation, a clean local default branch
with consistent live state, no matching local work ref, and no pending completion
evidence is settled history. An archive at its tip alone does not trigger recovery.
Do not require historical `head`/`sourceTree` objects for that orientation; clean
clones and Git pruning legitimately lose them. This is not a new claim about past
verification. A reset stub alone proves nothing: check the refs, cleanliness, and
live state too. Missing objects still block actual recovery and explicit resume.

## Prove an actual recovery candidate

For feature archives on a reused branch, exclude a prior build only when all of
these read-only Git checks pass:

- `../../feature/reference/build-history.md` proves its unique unchanged archive
  addition on the local default, and the introducing commit's sole parent equals
  that archive annotation's `baseCommit` on the same `baseRef`.
- An exact completed, unchanged, reachable rollback record names that archive and
  introducing commit; its commit is after the feature addition.
- The current work branch descends from a post-rollback local default: that
  rollback commit is an ancestor of the merge base of the current work branch
  and local default. Its old archive remains byte/mode-identical in both trees
  and the working tree, with no pending archive edits or retained review explicitly
  targeting that old build.

Different spec bytes, title, attempt, filename, or ancestry alone never exclude
an archive. Missing, changed, or contradictory proof stops; this exception does
not recover old missing inputs or waive current gates. It permits legacy branch
reuse only after the old lifecycle is demonstrably finished and reversed.

Require one annotated archive matching the recorded work branch, or the exact
archive/commit proof in the merged phase below. A real live spec must match its
recovered bytes; the canonical stub is also expected. A different spec conflicts.
For features, use the recovered spec's frozen `**Build attempt:**` and that exact
archive path; never allocate a new attempt on resume. For a legacy feature spec
without the field, the path plus existing annotation fixes the destination only
after the prior-build proof in `../../feature/reference/build-history.md` at its
recorded `baseCommit` uniquely establishes its attempt. Exclude the current archive from those prior
builds. Do not edit the recovered bytes to insert metadata.

Require all recorded commits and `sourceTree` to exist (`git cat-file -e`).
Unreferenced source trees can be pruned by Git: missing objects stop recovery;
request the original objects or an identified backup, never recreate a guessed
baseline. An old archive without this annotation may be read as history, but
cannot automatically recover a missing live spec through this contract.

Use the temporary-index command above to inspect the present work tree without
altering the real index. Compare trees with `git diff --raw -z <source> <current>`
and inspect source blobs with `git show <sourceTree>:<path>`. Git trees use clean-
filtered bytes; compare evidence through `git hash-object --path=<path> --stdin`
when ordinary EOL conversion applies, while recovering the exact spec only by
its archive digest above. Unsupported custom filters stop recovery. Inspect staged
changes too; conflicting staged/working versions must be reconciled explicitly.
Do not infer identity from ancestry alone, a matching filename, or a latest date.

## Validate only the expected completion changes

Reconstruct the original spec and evidence from the source tree and archive.
Every changed path, file mode, addition, and deletion must be accounted for.
Only these exact transformations can follow the captured source tree:

- Add this one archive, with the exact spec prefix and annotation, resolved
  findings copied with only the documented ID prefix, the original passing
  receipt bytes, and a try guide for this spec when required or already generated.
- Apply this work item's exact build-plan checkbox/parent changes, or its exact
  rollback note. Change only the overview's existing source-hash value, using
  the documented hash contract. A fix has no build-plan change.
- Remove only resolved ledger entries present in that archive. Preserve every
  `open`, `fixed`, and `unverified` entry byte-for-byte, including its ID. The live
  ledger may be the original, the exact expected remainder, or its canonical stub
  only when no unresolved entry exists. Never merge conflicting versions by guess.
- Replace the matching live receipt and original spec with their canonical stubs.
  Until reset, each must still equal its exact source bytes. Missing previously
  present files or partial resets block recovery. Only a validated `absentOptional`
  entry allows its optional file to remain absent during unfinished precommit
  work, then be created as exactly the canonical stub. Finished bookkeeping
  requires that stub. Source-tree absence alone, including ignored existing
  evidence, never permits this exception. Never infer an absent active spec.
- Delete only the exact consumed prototype files already authorized for this
  work item and identified by its design reference. No general cleanup is allowed.

No other history, context, configuration, product, test, or ignore-rule changes
are completion bookkeeping. Read the full diffs, not just a filename allowlist.
Partial plan bookkeeping is recoverable only when each changed byte is one of
these transformations and all unfinished operations can be identified exactly.
Conflicting or partial archive/evidence content stops before any live reset.

For independent review, validate the archived receipt against its original
`Target commit`, original base/merge-base, exact recovered spec digest, reviewer
identity, execution/context pairing, required Check result, and receipt sections.
The annotation's `head` must equal that target, and its source tree may differ
from the target only in the original review/findings evidence permitted by Audit.
Never relabel the receipt as current at the later work commit or merge commit.
When the original receipt has `Spec snapshot`, preserve that field unchanged.
After live reset, the hash-proven original archive prefix may establish the same
spec identity: require its exact digest to equal the receipt's `Spec hash` and the
annotation's `specSha256`, and require the snapshot field's canonical path to
contain that original target and hash. This is archived-receipt validation, not
a current live receipt. Do not create a new snapshot or relabel the target.
Conflicting retained snapshot bytes or unsafe paths still stop recovery; an
absent local snapshot may use this exact archive proof after reset. This does
not replace source-tree/product proof or recover other ignored evidence.
The narrow completion changes above preserve the reviewed product; any other
change requires restored exact active inputs and renewed gates/checkpoint/review.
Never overwrite conflicting live evidence to obtain that restoration.

Ignored local-only files are absent from this tree proof. Validate them using
separately provable exact original bytes plus the archive and retained inputs,
or stop and name the missing evidence. A local archive can match a still-existing
work branch; its presence alone cannot bind an already-deleted branch to a squash
commit. Do not force-add ignored workflow files to make recovery pass.

## Interrupted archival, before the work commit

Require the recorded work branch at the recorded `head` and a complete matching
archive. For local landing, require the local default still at `baseCommit`. For
pull-request landing, require `baseCommit` remains an ancestor of the current
local default and work branch; default-branch advancement is expected. Require
only the validated partial or finished bookkeeping changes above. Reconcile
archived and retained findings and review before changing anything. Do not
duplicate sections or erase unresolved entries. If the archive is absent and
live inputs are intact, use normal Complete; if both the archive and needed live
input are missing, stop for recovery evidence.

Read the recovered spec from a temporary file, preserving its exact bytes; do
not overwrite the live stub merely to orient a fresh session. Repeat current-
session Verify and required gates against that spec and the current product.
Reuse a passing archived review only through the original-target checks above.
If a gate needs active files restored, restore only proven matching originals
with no conflicting live data, run the gate, and re-enter normal Complete. If
verification or review changes evidence, stop and reconcile a new reviewed archive
candidate explicitly; never silently append to the existing archive.

Finish only the missing bookkeeping, with live resets last. Show the concrete
remaining diff and proposed conventional work commit, obtain normal commit
approval, and continue at Complete Step 2. This archive does not authorize Git.

## Work committed, awaiting landing

Require a clean recorded work branch at one unambiguous final work commit whose
sole parent is recorded `head`. For local landing, require the default still at
`baseCommit`. For pull-request landing, require `baseCommit` remains an ancestor
of the current local default and work branch. Compare the complete work commit
tree to `sourceTree` and require exactly the finished transformations above.
The tracked archive and final bookkeeping must be in that commit, not added later.
For ignored evidence require the separate proof described above. Extra commits or
post-commit drift stop for review, not another completion commit.

Rerun current-session Verify and validate all required gates using the recovered
spec and original receipt. Resume at Complete Step 3's configured landing path.
Never make a second work commit, reset evidence again, or treat earlier approval
as covering new changes. Preserve the exact work commit SHA for landing
verification.

## Pull request opened or merged

Use this phase only for a schema 2 `pull-request` annotation. Require the clean
recorded work branch at its exact final work commit and the work-commit proof
above. Use the authenticated hosting CLI or API to find exactly one pull request
whose repository, base branch, head branch, and head commit match the recorded
values. A branch name or archive alone is not enough.

When the pull request is open, verify its current head is unchanged, report its
URL and check state, and stop. Never update the branch, merge, enable auto-merge,
or delete a branch during recovery without the separate approval required for
that action.

When the provider reports it merged, require squash-merge evidence: one merge
result commit with one parent, the recorded `baseCommit` as an ancestor of that
parent, and the exact archive added unchanged by that commit. Require the
provider record to bind that result to the exact pull request and recorded work
commit. Fetch the named remote read-only when needed to inspect the result, then
require the remote default branch to contain it. Later default-branch commits are
allowed. A merge commit, rebase merge, changed head, closed-unmerged request, or
ambiguous provider result stops with the exact mismatch.

Report the remote work complete. Fast-forward a clean local default checkout and
delete local or remote work branches only with explicit approval. Never mutate a
default branch checked out in another worktree, and never treat pull-request
creation approval as cleanup approval.

## Merge already completed

Use this phase only for schema 1 records and schema 2 `local-merge` records.

Require a clean local default branch tip whose sole parent is the recorded
`baseCommit`, and the complete finished tree and archive. If the work branch still
exists, require its exact final work commit and tree equality with that default
tip (`git diff --exit-code <workCommit>^{tree} <defaultTip>^{tree>`), including the
archive blob. A squash merge normally does not contain the work commit as an
ancestor. Tree equality alone without the matching base, archive, and completed
bookkeeping is insufficient.

If the work branch was deleted, require the tracked archive at the default tip,
its exact source-tree/spec/branch annotation, and exactly the finished changes
from sourceTree to that tip. An ignored archive without a provable commit binding
must stop for user identification and supporting evidence. If the default has
advanced or several commits/archives fit, stop and name the ambiguity instead of
weakening this proof or searching by title.

Do only pending cleanup already authorized for this work item; ask if cleanup
approval is missing. Never repeat archival, the work commit, or the squash merge,
and never create a cleanup commit on the default branch. If nothing remains,
report the verified local merge once and leave Git unchanged. Push still needs
its separate approval. A repeated resume follows this same no-op path.
