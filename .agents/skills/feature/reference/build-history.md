# Build history identity

Read metadata from the archived original spec, not appended findings or review.
Read the feature ID from its `**From build-plan:**` or supported legacy
feature field, not its title or filename. Normalize the numeric part by removing
leading zeros and the optional letter to lowercase (`012A` becomes `12a`). Match
that complete ID, never a substring. Use the archived spec's positive integer
`**Build attempt:**`; duplicate or malformed fields stop selection. A legacy
archive without the field counts as attempt 1, or as N when its path ends in
`--build-N.md`. Text such as `Build 2` in a title proves no attempt.

For new paths, pad the numeric part to at least two digits, keep its letter, and
use the spec title's lowercase kebab-case slug. Append `--build-N` only for N > 1.
The double hyphen is reserved: slug normalization collapses punctuation runs to
one hyphen, so a first build titled `Export Build 2` uses `04-export-build-2.md`,
while a later attempt 2 titled `Export` uses `04-export--build-2.md`.

Allocate the attempt from this feature's archives under
`blueprint/history/features/`: use 1 when none exist, otherwise one greater than
the highest attempt among them. A later build happens only after the user removed
the earlier one through ordinary work, such as a `/fix`, and unchecked its
build-plan item. Search only this feature's records.

Before freezing a new spec, check its exact planned archive path and branch.
Require `lstat` to return `ENOENT` for the archive leaf; any existing entry,
including a dangling symlink, blocks it. Present parents must be ordinary
directories. Require a valid branch name and no namespace-conflicting local
branch ref (inspect `git for-each-ref refs/heads/`, including packed refs). An
exact existing planned branch is allowed only when it is the current branch in
this checkout, its `HEAD` equals the local default branch, and the working tree
has no project changes. This is the pre-created worktree case. Any other exact
existing branch blocks the new spec.

Any collision stops before spec review with the exact path or ref. Do not
auto-bump the attempt or rename reviewed work to avoid it. These checks apply to
new specs; existing completion must run its recovery routing first so its own
archive is reconciled rather than rejected. Preserve already-reviewed legacy spec
bytes, branch, and any proven recovery destination.
