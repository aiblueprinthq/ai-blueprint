# Check guide - manual review guide

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Where this sits in the workflow:

    /implement or /complete  ->  [check guide]  ->  human review
    (work exists)                (manual   (where to go,
                                  path)     what to click)

`/check` proves behavior from the agent side. `/check guide` gives the user a practical
manual walkthrough: start this command, open this route, click these controls,
expect this result, and watch for these failure signs.

It is always read-only. Do not edit files, write activity state, update spec
status, run checks or the app, install dependencies, commit, merge, push, or
produce verification receipts. Reading files and git status is allowed. A guide
never counts as acceptance evidence or proof that any check passed.

The quality-gate config controls when another workflow generates this guide
automatically. An explicit `/check guide` or `$check guide` request always runs.
A generated guide never counts as evidence that the user performed the walkthrough.
Try It Now is a user demonstration, not a replacement for tests, Verify, or
`/check`.

## Input

Optional scope:

- no argument: use the active feature, fix, or rollback in
  `blueprint/context/current-feature.md`
- `latest`: use the most recent archive under `blueprint/history/features/`,
  `blueprint/history/fixes/`, or `blueprint/history/rollbacks/`
- a step name or number: focus the guide on that current-feature step
- a path, route, or command: include it as the main thing to try

If there is no active feature and no useful archive, ask what change the user
wants to try instead of guessing.

## Step 1 - find the work to explain

Read:

- `AGENTS.md`
- `blueprint/config.json`
- `blueprint/context/current-feature.md`
- `blueprint/context/project-overview.md`
- `blueprint/context/coding-standards.md`
- `blueprint/build-plan.md`
- latest files under `blueprint/history/features/`,
  `blueprint/history/fixes/`, and `blueprint/history/rollbacks/`, if the current
  feature is reset
- git branch and working tree status

For `latest`, use the most recent archive even when an active spec exists.
Otherwise prefer the active spec. If `current-feature.md` is the reset stub, use
the most recent archived feature, fix, or rollback by filename or modification time and
say that is what you used.

Do not dump the spec. Pull out the routes, commands, UI surfaces, CLI commands,
API endpoints, data states, and done-whens that matter for a human trying it.
For a rollback, lead with the path that proves the removed behavior is gone, then
include one unaffected regression path from the rollback spec.

## Step 2 - classify the observation path

For `when-testable`, generate Try It Now only when one safe, meaningful path
directly observes behavior added or changed by this work. The path must use
documented project commands or concrete spec details, require no invented
credentials or data, avoid destructive effects, and usually take less than a
minute.

Testable paths include:

- **CLI** - one command with the exact expected terminal output.
- **Library** - one runnable snippet or sample call with expected console output.
- **API** - one request with the expected status and response body or fields.
- **UI** - one route and short interaction with the exact visible result.
- **File generation** - one command with the expected file path and key content.
- **Configuration or data** - one exact artifact, query, or state to inspect.

Documentation-only edits, comments, formatting, release metadata, internal
refactors with unchanged observable behavior, and invisible defensive changes
without a safe public signal are not testable. Do not substitute a unit test,
build command, vague inspection, or invented scenario just to produce a section.
Configuration and data changes still qualify when the changed state has a safe,
exact inspection path.

When an automatic `when-testable` run finds no qualifying path, omit the
`## Try it now` section and report that the gate was skipped because no safe,
meaningful direct observation exists. For an explicit guide request, state that
plainly instead of inventing instructions.

## Step 3 - identify how to run the app

Use the Commands section in `AGENTS.md`. Match the project type:

- **Web app** - dev server command, URL, and the route or screen to open.
- **Server/API** - server command, base URL, endpoint, method, and expected
  response shape.
- **CLI** - exact command(s), arguments, and expected output.
- **Library** - example command, test fixture, REPL snippet, or sample call.
- **Hybrid app** - list the smallest set of commands needed, such as backend plus
  web dev server.

If the app may already be running, say how to reuse it. If a command is missing
from `AGENTS.md`, report that as a gap rather than inventing certainty.

Never start a development server in guide mode. When project instructions
require the user to start it, put that exact command under `Run or do` and make
clear that the user runs it. Prefer an API, MCP, or CLI demonstration before a
browser path when each proves the same behavior with less setup.

## Step 4 - write the Try It Now proof

When the work is testable, lead with exactly this compact section:

```markdown
## Try it now

Run or do:

<the smallest useful command or interaction>

Expected:

<the exact visible output, response, file, or UI state>

This proves:

<the specific part of the feature directly observed here>
```

Use one path, not a catalogue. Include exact output when practical. Keep `This
proves` narrow: it describes only the observed behavior and never claims that
tests, Verify, `/check`, or user acceptance passed.

For automatic `when-testable` generation, this section is normally the complete
output. The calling workflow must place it in the final handoff without reducing
it to a pointer.

## Step 5 - add deeper manual steps only when useful

For an explicit guide request, or when `always` or `when-user-facing` selected a
work item that benefits from more detail, follow Try It Now with these sections:

1. **Start** - commands to run and where to run them.
2. **Open** - URLs, screens, tabs, API endpoints, or CLI commands.
3. **Do** - clicks, inputs, selections, or command arguments.
4. **Expect** - visible result, output, response, state change, file, or lack of
   error.
5. **Watch For** - common wrong outcomes, console or network errors, stale data,
   missing fields, bad empty states, layout issues, or safety warnings.

Keep any deeper guide concrete. Prefer:

    Open http://127.0.0.1:7788/api/snapshot
    Expect a JSON object with `generated_at`, `services`, `projects`, and
    `conflicts`.

Avoid:

    Check that the snapshot works.

## Step 6 - include confidence and gaps

End with:

- **Best signal** - the one thing the user should try first.
- **Optional deeper checks** - only if useful.
- **Gaps** - anything the guide cannot know from the docs, such as missing route
  names, seed data, credentials, or external services.

If the feature is not user-visible but has a direct API, CLI, library, file, or
state signal, use that. If no direct signal exists, say so and omit Try It Now.

## Rules

- Read-only only. Do not edit, commit, merge, push, install, or delete.
- Do not run the app or verification commands in guide mode. If the user asks
  you to try it for them, leave guide mode and explicitly route to `/check`
  verification, following its activity and authorization rules.
- Do not pretend a path is known when the spec does not say it. Give the best
  supported path and label any remaining uncertainty. Do not emit Try It Now
  when the uncertainty would make the command or expected result speculative.
- Keep the guide short enough to follow while the app is open.
- Match the project's commands from `AGENTS.md`.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with numbered
steps for the manual path and short bullets for warnings.
