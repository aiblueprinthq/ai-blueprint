---
name: debug
description: Diagnose a failing test, build, crash, regression, or unexpected behavior without editing source. Reproduce the symptom, test hypotheses, identify the supported root cause, and hand off a repair. Use for /debug, root-cause investigation, or questions about why something is broken.
disable-model-invocation: true
---

# debug - find the cause before changing the code

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
activity contract. A missing or failing helper is a warning, not a blocker.

Where this sits in the workflow:

    reported failure  ->  [debug]  ->  /fix or /implement
    (test, build,          (reproduce,    (spec a new fix, or
     crash, behavior)       isolate,       repair active work)
                            explain)

`/debug` separates diagnosis from repair. It gathers evidence, narrows the
failure to a specific cause when possible, and stops with a useful handoff. It
does not make the code "temporarily work" while investigating.

## Input

Accept a symptom, failing command, error message, or unexpected behavior. Examples:

    /debug npm test fails in cart-total.test.js
    /debug the upload route returns 500 for PNG files
    /debug why does the production build fail?

With no useful symptom, ask for the expected behavior, actual behavior, and
smallest known reproduction. Do not guess which problem the user means.

## Step 1 - establish the boundary

Read the project instructions and the context relevant to the failure:

- `AGENTS.md` and its real commands
- `blueprint/context/project-overview.md`
- `blueprint/context/coding-standards.md`
- `blueprint/context/current-feature.md`
- the reported error, failing output, and affected files
- git status, diff, and recent log when a regression is possible

State the symptom and what would count as reproducing it. Note whether the
failure belongs to an active feature or is an unplanned bug.

Do not treat a dirty working tree as permission to discard or rewrite anything.
Use the diff as evidence and preserve it.

## Step 2 - reproduce safely

Run the smallest existing command or interaction that can reproduce the symptom.

- Prefer one focused test, request, CLI command, or input over the entire suite.
- Capture the exact exit code, error, stack trace, output, response, console
  error, or failed request.
- Reuse an already-running local app when available. If reproduction requires a
  long-running server that is not running, ask the user to start it and provide
  the documented command.
- Do not install dependencies, change configuration, run migrations, mutate
  production data, contact external users, or use destructive commands to force
  a reproduction.
- Do not edit code to add logs or probes. Use existing logs, debuggers,
  read-only inspection, or one-off commands that do not change project files.
- Compare git status after diagnostic commands. If one changes tracked or
  untracked project files, stop and report those paths. Do not clean, restore,
  or hide the changes.

If the symptom cannot be reproduced, say what was attempted and what evidence is
missing. Continue with static investigation only when it can produce a clearly
labeled hypothesis, not a claimed root cause.

## Step 3 - localize the failure

Trace from the observed failure toward the smallest responsible area.

Use the evidence that fits the project:

- the first relevant application frame in a stack trace
- the smallest failing test and its inputs
- request and response data at the failing boundary
- console and network errors
- callers, imports, data flow, and configuration reads
- `git diff`, `git log`, and `git blame` for a suspected regression
- comparison with a nearby working path or input

Separate facts from hypotheses. Test the cheapest safe competing explanations
first. Do not stop at the first plausible line, blame a dependency without
evidence, or confuse the place an error surfaced with the place it originated.

## Step 4 - confirm or narrow

A root cause is confirmed only when the evidence connects all three:

1. the triggering input or state
2. the responsible code, configuration, or contract
3. the observed failure

When safe and read-only, vary one input or run a smaller focused command to
confirm the connection. Do not change implementation or tests to prove the fix.

Use one of these verdicts:

- **Confirmed** - evidence identifies the cause and explains the failure.
- **Likely** - evidence narrows the cause, but one specific proof is unavailable.
- **Blocked** - the failure cannot be reproduced or required evidence is
  inaccessible.

## Step 5 - report and hand off

Give a concise debug report:

- symptom and reproduction
- verdict
- root cause or leading hypothesis
- evidence, including commands and relevant paths
- affected behavior and likely repair boundary
- what was not verified
- exact next action

Choose the next action without writing files:

- Active feature or fix caused the failure -> return the diagnosis to
  `/implement`.
- No active work item and the bug is confirmed -> recommend
  `/fix "<concise bug and confirmed cause>"`.
- Cause is only likely or blocked -> recommend the next diagnostic evidence, not
  a speculative repair.
- The issue is planned product work rather than a defect -> point to
  `/feature`.

## Rules

- Diagnose, do not repair. Never edit source, tests, configuration, lockfiles, or
  Blueprint files.
- Never create, switch, merge, or delete branches. Never commit or push.
- Do not update the findings ledger. `/audit` owns recorded code-quality
  findings; `/debug` reports one investigated failure in chat.
- Evidence outranks confidence. Label uncertainty and failed reproduction
  honestly.
- Preserve the user's working tree and running processes.
- Do not broaden one failure into a general audit or refactor.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown with a short
evidence list and a clear next action.
