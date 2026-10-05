# Build history identity

Read metadata from the archived original spec, not appended findings or review.
Read the feature ID from its `**From build-plan:**` or supported legacy
feature field, not its title or filename. Normalize the numeric part by removing
leading zeros and the optional letter to lowercase (`012A` becomes `12a`). Match
that complete ID, never a substring. Use the archived spec's positive integer
`**Build attempt:**`; duplicate or malformed fields stop selection. A legacy
first-build archive without it counts as attempt 1 only when its spec identity
and unsuffixed `NN-name.md` path agree unambiguously. Derive the expected name
from its own spec, not today's renamed plan title. Text such as `Build 2` in a
title proves no attempt.
For new paths, pad the numeric part to at least two digits, keep its letter, and
use the spec title's lowercase kebab-case slug. Append `--build-N` only for N > 1.
An archive declaring an attempt must agree with that computed path.
The double hyphen is reserved: slug normalization collapses punctuation runs to
one hyphen, so a first build titled `Export Build 2` uses `04-export-build-2.md`,
while a later attempt 2 titled `Export` uses `04-export--build-2.md`.

Before freezing a new spec, check its exact planned archive path and branch.
Require `lstat` to return `ENOENT` for the archive leaf; any existing entry,
including a dangling symlink, blocks it. Present parents must be ordinary
directories. Require a valid branch name and no namespace-conflicting local
branch ref (inspect `git for-each-ref refs/heads/`, including packed refs). An
exact existing planned branch is allowed only when it is the current branch in
this checkout, its `HEAD` equals the local default branch, and the working tree
has no project changes. This is the pre-created worktree case. Any other exact
existing branch blocks the new spec.
Also require no prior use of the archive path in available Git history:

```bash
git log --all --reflog --full-history --format=%H -- <planned-archive-path>
```

Any disallowed ref, history result, or inspection failure stops before spec
review with the exact collision.
Do not auto-bump the attempt or rename reviewed work to avoid it. These checks
apply to new specs; existing completion must run its recovery routing first so
its own archive is reconciled rather than rejected. Preserve already-reviewed
legacy spec bytes, branch, and any proven recovery destination.

A legacy rebuild can preserve a reviewed spec without this field. Its completion
annotation must freeze the original `baseCommit`: resolve only prior builds and
their completed reversals present at that base, derive `max(attempts) + 1`, and
require the exact resulting archive path. For an integrated local-merge archive,
its unique introducing commit's sole parent must equal that base. For an
integrated schema 2 `pull-request` archive, its unique squash commit must have one
parent, that parent must descend from `baseCommit`, and the archive must be added
unchanged there. For unfinished completion, use Complete's phase proof. The path
checks this derived attempt; it never supplies the number. Missing or ambiguous
proof stops without rewriting the archived spec.
Settled history numbering and rollback selection do not require the annotation's
historical `head` or `sourceTree`; actual completion recovery still requires them.

Before using prior builds or reversals, prove each selected record on the local
default branch. Resolve the unique introducing commit with:

```bash
git log --full-history --diff-filter=A --format=%H <local-default> -- <archive-path>
git log --full-history --format=%H <introducing-commit>..<local-default> -- <archive-path>
```

The first result must contain exactly one commit which actually adds the path;
the second must be empty. Confirm the current blob and mode equal that addition
(use Git's normal EOL normalization for a working-file comparison). Inspect the
record at that commit, not an uncommitted replacement. Reject orphan, overwritten,
deleted/re-added, renamed, multiply-added, or conflicting records. Never choose
the newest commit, file count, or timestamp to resolve ambiguity.

A build is reversed only by a completed `**Type:** Rollback` record with its exact
`**Target archive:**` and full `**Target commit:**`, matching feature ID, verified
or complete status and finished steps. Its `Target parent` must match the target's
sole parent. Prove that rollback record's unique unchanged addition
by the same procedure, reachable on the local default after the target build.
Require a non-merge rollback commit containing that record and its completed
plan bookkeeping. Uncommitted, malformed, changed, or merely rollback-looking
files are not completed reversals. Conflicting or duplicate reversals stop.

Include exact rollback references retained on the selected plan line; missing
referenced records are a blocker, not an empty history. For a new unchecked feature,
use 1 when there are no prior records; otherwise
require every prior build to have one proven completed reversal and allocate
`max(attempts) + 1`. Duplicate attempts or inconsistent/missing history stop with
the exact paths and missing proof. Search only this feature's records and their
exact reversal references. Ignored local-only history without introducing-commit
proof cannot establish a rebuild or rollback target; stop without force-adding or
migrating it. Ordinary first builds do not require prior history.
