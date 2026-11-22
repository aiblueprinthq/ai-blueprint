---
name: check
description: Check the running app, CLI, or server against the active spec's done-when criteria and capture pass or fail evidence without editing source. Use /check to verify real behavior, /check guide [latest|scope] for a read-only walkthrough of how to test manually (where to click, expected and incorrect results), or /check demo [latest|scope] to watch it run live in a browser with narration.
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
- `/check demo` or `$check demo`: run the work's Try It Now path live in a
  browser the user can watch, narrating each step. Pass remaining arguments
  such as `latest`, an archive path, a step, or a route to `reference/demo.md`.
  Read and follow that reference only. Do not write activity state, edit files,
  update spec status, or produce verification receipts.
- A natural-language request to watch the work run, such as "show me it
  working" or "walk me through it live", also selects demo mode. A request for
  proof that it works selects verification.
- `/check` or `$check`, optionally with a verification scope: verify observed
  behavior against the spec. Follow verification startup below, then read and
  follow `reference/verify.md` only.

Load only the selected reference. Do not read the other references
preemptively. Guide generation never satisfies a verification gate. The existing
`qualityGates.regular.tryGuide` and `qualityGates.continuous.tryGuide` keys now
select `/check guide`. `manual`, `always`, and `when-user-facing` retain their
existing behavior. `when-testable` asks guide mode to classify whether the work
has a safe, meaningful observation path and generate a compact `## Try it now`
section only when one exists. The separate `check` gates continue to select
verification mode.

A demo is not verification either: it never marks a done-when passed, changes
the spec status, or counts as UI evidence or the user's acceptance. The
`qualityGates.regular.demo` and `qualityGates.continuous.demo` keys select
automatic demos in Complete and Continuous. `manual`, the default, runs one only
on request; `when-available` runs one when demo mode's live conditions hold.

## Verification startup (verification mode only)

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` when `blueprint/.state/`
exists, with command `check`. From the project root, run the first helper that
exists, `node .agents/skills/blueprint-doctor/scripts/run-state.mjs` or
`node .claude/skills/blueprint-doctor/scripts/run-state.mjs`, with `start --command
<skill> --summary "<truthful summary>" --boundary
<read-only|reviewed|local-only>`. Use `update` at milestones, with `--status
blocked --resume <command>` for a blocker, and `finish --status ready|completed`
at the end; `--help` lists every option and `blueprint/workflow.md` has the full
activity contract. A missing or failing helper is a warning, not a blocker. This
precedes reading the verification reference. Guide and demo modes must skip this
startup entirely.
