---
name: tests
description: Set up unit testing with /tests or /tests unit, or explicitly set up browser and end-to-end testing with /tests browser. Reuse or install a suitable test runner, add one example or smoke test, document commands, and verify. Use check for one-time live verification.
disable-model-invocation: true
---

# tests - set up unit or browser testing

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` when `blueprint/.state/`
exists. From the project root, run the first helper that exists,
`node .agents/skills/blueprint-doctor/scripts/run-state.mjs` or
`node .claude/skills/blueprint-doctor/scripts/run-state.mjs`, with `start --command
<skill> --summary "<truthful summary>" --boundary
<read-only|reviewed|local-only>`. Use `update` at milestones, with `--status
blocked --resume <command>` for a blocker, and `finish --status ready|completed`
at the end; `--help` lists every option and `blueprint/workflow.md` has the full
activity contract. A missing or failing helper is a warning, not a blocker. Use
`tests` as the command for either setup mode.

## Select the setup

- `/tests` or `/tests unit`: set up stack-native unit testing. Read and follow
  `reference/unit.md` only.
- `/tests browser`: set up a repeatable browser harness. Read and follow
  `reference/browser.md` only.
- An explicit natural-language request to set up browser or end-to-end testing
  selects browser setup too. A runner name alone never selects browser setup.
  For example, `/tests Playwright` remains a unit request with a runner
  preference to clarify, not permission to install browser automation.
- If the user requests both modes, ask which to set up first. Complete one setup
  at a time. If the requested mode is unclear, clarify before editing.

Load only the selected reference. Do not read both references preemptively.
Treat any remaining runner or stack arguments as preferences to verify against
project files, never as permission to expand the selected setup.

Follow the selected reference's inspection, approval, verification, and report
steps. Unit setup may add tests to an existing Verify command; browser setup
must not add its slower gate to Verify or CI without a separate request or an
existing project requirement. Neither mode creates CI just by being invoked.
Do not commit, merge, push, publish, or begin product feature work.
