---
name: check
description: Check the running app, CLI, or server against the active spec's done-when criteria and capture observable pass or fail evidence without editing source. Use /check to verify real feature behavior, or /check guide [latest|scope] for a read-only manual walkthrough: how to test manually, where to click, expected and incorrect results, or a human review path.
disable-model-invocation: true
---

# check - verify behavior or explain how to try it

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

## Select the mode before any tool call

- `/check guide` or `$check guide`: generate a read-only manual walkthrough.
  Pass remaining arguments such as `latest`, a step, a path, route, or command
  to `reference/guide.md`. Read and follow that reference only. Do not write
  activity state, run checks or the app, edit files, update spec status, or
  produce verification receipts.
- A natural-language request for instructions on how the user can manually test
  or review a change also selects guide mode. If the request mixes a guide with
  agent verification, clarify which mode to run first before any activity.
- `/check` or `$check`, optionally with a verification scope: verify observed
  behavior against the spec. Follow verification startup below, then read and
  follow `reference/verify.md` only.

Load only the selected reference. Do not read both references preemptively.
Guide generation never satisfies a verification gate. The existing
`qualityGates.regular.tryGuide` and `qualityGates.continuous.tryGuide` keys now
select `/check guide`. `manual`, `always`, and `when-user-facing` retain their
existing behavior. `when-testable` asks guide mode to classify whether the work
has a safe, meaningful observation path and generate a compact `## Try it now`
section only when one exists. The separate `check` gates continue to select
verification mode.

## Verification startup (verification mode only)

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` using the dashboard activity
contract in `AGENTS.md`, with command `check`. This precedes reading the
verification reference. Guide mode must skip this startup entirely.
