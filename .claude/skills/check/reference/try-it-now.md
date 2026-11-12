# Check guide - Try It Now

`/check guide` follows this after its Step 1 finds the work. A workflow that
already holds the active spec and the Commands section from `AGENTS.md`, such
as `/implement`, starts here directly. Writing the proof is read-only: do not
edit files or run checks or the app for it, and never treat it as acceptance
evidence.

When the spec lacks a route, command, data state, or credential detail the
demonstration needs, search `blueprint/context/project-overview.md` or
`blueprint/build-plan.md` and read only the matching passage. Otherwise skip
both. A detail still missing after that is a gap to report, never one to invent.
When the work removed behavior, lead with the path that proves it is gone, then
include one unaffected regression path.

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
