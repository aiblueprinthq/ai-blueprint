# Completion archive

Use this contract on every completion: capture the verified source tree, build
one annotated archive, and verify a local squash merge. Recovery reads the same
annotation to prove an interrupted or resumed completion.

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
JSON comment before any Findings, Independent review, Try it now, or legacy
Manual try guide section:

```text
<!-- blueprint:completion {"schemaVersion":2,"specBytes":123,"specSha256":"<64 hex>","branch":"refs/heads/feature/name","head":"<full SHA>","baseRef":"refs/heads/main","baseCommit":"<full SHA>","sourceTree":"<full tree SHA>","landing":"local-merge","absentOptional":[]} -->
```

Schema 1 annotations remain valid legacy `local-merge` records. Schema 2 requires
`landing` to be exactly `local-merge` or `pull-request`. Reject unknown versions,
missing schema 2 landing values, or values that disagree with the active
completion path.

Use `Buffer.length` and SHA-256 over the exact file bytes.

Build the complete archive in a temporary file first, including all resolved
findings, the exact passing receipt when present, and any generated try guide.
Validate it against its inputs, then place it at the intended absent archive path.
Never overwrite an existing archive: a matching one enters recovery; a conflicting
one stops for an exact path decision. Finish plan/overview bookkeeping, then
remove only the archived findings and reset review. Reset the active spec last.
Do not append sections incrementally to an existing archive during recovery.

## Verify a local squash merge

Require a clean local default branch tip whose sole parent is the recorded
`baseCommit`, and the complete finished tree and archive. If the work branch still
exists, require its exact final work commit and tree equality with that default
tip (`git diff --exit-code <workCommit>^{tree} <defaultTip>^{tree}`), including the
archive blob. A squash merge normally does not contain the work commit as an
ancestor. Tree equality alone without the matching base, archive, and completed
bookkeeping is insufficient.
