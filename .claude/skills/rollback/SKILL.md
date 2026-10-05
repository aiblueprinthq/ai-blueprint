---
name: rollback
description: Plan a safe history-preserving reversal of a completed feature from its archive and exact commit, including later-dependency risk, then stop before implementation. Use for /rollback or requests to undo, remove, or reverse a completed feature.
disable-model-invocation: true
---

# rollback - safely reverse a completed feature

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`.

Where this sits in the workflow:

    completed feature + git history  ->  [rollback]  ->  /implement  ->  /check  ->  /complete
    (archive + squashed commit)           (risk review     (reverse       (prove)     (log + merge)
                                           + spec)          product diff)

This skill plans a rollback. It does not change product code, create a branch,
commit, merge, or push. It identifies the completed feature and its exact git
commit, checks what changed afterward, writes a guarded rollback spec, then stops
for review. `/implement` performs the reversal only after the user approves that
spec.

## Input

A completed feature by build-plan number, name, or archive path, plus an optional
reason. Examples:

    /rollback 4 because the new export flow is corrupting files
    /rollback "PDF export"
    /rollback blueprint/history/features/04-pdf-export.md

With no target, list a short set of recent completed feature archives and ask the
user to choose. Never silently pick the latest feature. If the reason is missing,
ask for one before writing the spec because the rollback archive must explain why
the feature was removed.

## Step 0 - preflight

Read `AGENTS.md`, `blueprint/build-plan.md`,
`blueprint/context/current-feature.md`, the completed feature archives, and git
state.

Stop before writing when:

- the directory is not a git repository
- `current-feature.md` already holds active work. Never replace another worker's
  active spec; parallel work uses one clone or Git worktree per work item, with
  a separate branch in each checkout
- the working tree is dirty, including unrelated untracked work
- the current branch is not the local main or default branch
- the target is not a checked build-plan feature with a matching archive
- the archive or its introducing commit cannot be identified unambiguously

Do not stash, discard, fetch, pull, switch branches, or clean the tree from this
skill.

## Step 1 - resolve the exact feature

Resolve the requested number or name to one checked build-plan ID; for an archive
path, read its exact spec identity first and match that checked item. Then gather
all exact-ID feature archive candidates using `../feature/reference/build-history.md`.
Normalize the stable ID, retaining its letter, and read attempts from verified
spec metadata/history proof, never arbitrary title or filename suffixes.

For each candidate, require its unique introducing commit on the local default
and prove the archive blob and mode have not changed since that addition. Exclude
builds with a proven completed reachable rollback naming that exact archive and
introducing commit. The checked item must have exactly one unreversed build.
An explicit archive request stays bound to that exact path: reject it if already
reversed, rather than silently choosing another build. Ambiguous, orphan,
overwritten, multiply-added, or missing records stop with their exact paths and
missing proof. Do not select by newest commit, filename order, or rollback date.

Confirm the selected commit's diff is consistent with the requested feature.
If the target is a merge commit, stop before Step 2 and before
writing or changing `blueprint/context/current-feature.md`. Do not record a
target parent or choose a mainline. Publish `blocked` to
`blueprint/.state/run.json`, explain that Blueprint cannot safely infer which
merge parent represents the pre-feature state, and include the exact `/rollback`
command the user can rerun after choosing a safe remediation or mainline
strategy. `/implement` retains its merge-target stop as defense in depth. If the
archive was never committed, explain that git cannot reconstruct a safe rollback
from it.

## Step 2 - separate product changes from Blueprint history

Inspect the target commit and build the product-path set from the files it
changed. Exclude these protected workflow paths:

- `.agents/**`
- `.claude/**`
- `blueprint/**`
- `AGENTS.md`
- `CLAUDE.md`
- `prototypes/**`

The rollback must preserve the original feature archive, later planning changes,
the active rollback spec, adapter skills, and throwaway prototype history. Root
`README.md` and ordinary app docs are product files unless the project says
otherwise.

If no product paths remain, stop. Do not create an empty rollback that only
rewrites Blueprint records.

## Step 3 - review later-change risk

Inspect every commit after the target through `HEAD` that touches one of the
product paths. Also read later completed feature specs when they mention the
target, its contracts, routes, data, or files.

Classify the result:

- **No overlap** - no later commit touched the target product paths.
- **Overlap, likely compatible** - later edits touched the same paths, but the
  target change can be reversed without removing their behavior.
- **Dependency risk** - later work appears to require the target's API, schema,
  route, component, or data.
- **Blocked** - safe behavior after reversal is unclear, data migration would be
  destructive, or a cascading rollback would be required.

Path overlap is a warning signal, not proof of dependency. Explain the concrete
later commit and contract involved. Never silently cascade into reverting other
features. For a blocked case, stop and ask the user to choose a narrower
remediation or explicitly plan the dependent rollbacks.

## Step 4 - write the rollback spec

Write `blueprint/context/current-feature.md` using
`reference/rollback-spec-template.md`. Its first heading must be exactly
`# Rollback: Feature <id> - <title>`, and it must retain the existing
`**Type:** Rollback` contract. Fill in:

- the full rollback branch from the configured prefix plus the rollback title in
  lowercase kebab-case, appending `--build-N` for target attempt N > 1 proved above
- target feature and archive
- target commit and parent commit as full 40-character SHA values
- user's reason
- product paths introduced or changed by the target
- protected workflow paths
- later commits reviewed and the risk classification
- compatibility work that is allowed, if any
- exact verification commands and observable removal criteria

Before freezing a new rollback spec, apply the archive-path and branch-availability
checks in `../feature/reference/build-history.md` to its planned branch and
`YYYY-MM-DD-<exact-target-archive-stem>.md` destination. Retain `--build-N` in the
target stem when present. A collision stops for an explicit decision; never
renumber the target or silently rename reviewed work. Existing completion recovery runs first.

The first build step must apply the target commit's product diff in reverse using
the guarded Type: Rollback behavior in `/implement`. Later steps may repair only
the specific downstream compatibility issues named in the spec. Do not use a
rollback as permission for unrelated cleanup.

Older installations may not have `blueprint/history/rollbacks/` yet because
updates preserve user history. That is not a planning blocker; `/complete`
creates the directory when it archives the approved rollback.

Red-team the draft before presenting it:

- does it preserve all Blueprint history and later plan changes?
- could it remove data or require a destructive migration?
- does later code import or call something the target introduced?
- are the removal criteria observable rather than phrased as "feature gone"?
- can each compatibility edit be reviewed separately?

Tighten the spec, then stop. Summarize the target commit, affected product paths,
later-change risk, and what the critique changed. Tell the user to review the
spec, then run `/implement` to create the rollback branch and apply it.

## Rules

- Preserve history. Never delete or rewrite the original feature archive.
- Plan only. This skill writes the rollback spec and nothing else.
- One completed feature per rollback.
- Record both the target commit and its parent as full 40-character SHA values.
  Each value must resolve to the recorded commit in the current repository.
- Never use `git reset --hard`, force-push, history rewriting, or broad file
  restoration.
- Never infer permission to cascade into later features or destroy stored data.
- A rollback still uses `/implement`, `/check`, and `/complete` review gates.

## Formatting

Format the output to match `blueprint/context/ai-interaction.md`: concise,
scannable markdown with a small risk table when later commits overlap.
