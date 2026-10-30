# Check verification

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Verification activity was started by the dispatcher before loading this reference.

Where this sits in the workflow:

    /implement  ->  [check]  ->  /complete
    (built a       (run the app,    (only once the
     step or        prove each       done-whens are
     the feature)   done-when)       proven)

`/implement` builds and does a quick build-plus-screenshot check inline. `/check`
is the deeper, repeatable gate for when a "done when" needs the *real running app*,
not just a green build: a click that triggers a download, a route that returns a
file, a flow across screens. Run it on a single step whose done-when is
behavioral, or on the whole feature as the acceptance check before `/complete`.

The point is evidence. A passing build proves the code compiles; `/check` proves
the thing the spec promised actually happens. It changes no source and commits
nothing - it runs the app and reports what it saw.

## Input

Optional: a specific thing to check (a step, a flow, a URL). With no argument,
verify the whole current feature against every "done when" in
`blueprint/context/current-feature.md`.

## Step 1 - build the checklist

Read `blueprint/config.json` first. A missing file means the built-in defaults
apply. If the file exists but is invalid, stop and point the user to `/blueprint-doctor`.
Configuration never grants permission to start a server or take any other action
that the project instructions or user have not authorized.
The quality-gate config controls automatic invocation only. An explicit `/check`
or `$check` request always runs.

Read `blueprint/context/current-feature.md`. Pull the observable "done when"
criteria from the build steps (and any acceptance notes in the Testing section).
Turn them into a concrete checklist of claims to prove - each one a specific,
observable behavior, not "it works". If the user named one thing, scope to that.

If there's no current feature spec, ask what to verify rather than guessing.

## Step 2 - get the app running

Use the project's real commands (see Commands in `AGENTS.md`). Match the project
type:

- **Web app** - start (or reuse) the dev/preview server, then drive a real browser
  to the relevant routes. Prefer reusing an already-running server over starting a
  duplicate. If `AGENTS.md` declares `Browser tests: <command>`, run that exact
  command as repeatable evidence and use its harness for covered interactions.
  Reuse runner-owned server lifecycle instead of starting a duplicate. A green
  suite is one evidence source, not proof of claims it does not observe. If no
  command is declared but Playwright is already installed, prefer it for browser
  driving, screenshots, console errors, and failed request checks. Never install
  it from `/check`; use another real-browser evidence path and report what you
  used, or point to `/tests browser` for later optional setup.
- **CLI** - run the actual command(s) with representative inputs.
- **Server/API** - start it and hit the endpoints.
- **Library** - exercise the public API through an example or the test command.

If a `test` command is declared in `AGENTS.md`, you may run it as *one* input, but
`/check` is broader than unit tests: it checks real behavior, which is exactly the
evidence UI and integration steps ride on instead of unit tests.

## Step 3 - exercise each claim

Drive the app to each checklist item and capture evidence as you go:

- Navigate and interact for real (click, type, submit, download) - don't assert
  from the code what the running app would do.
- Capture **screenshots** for visual/UI claims, **output** for CLI/API claims.
- Watch for **console errors and failed network requests**; a clean-looking screen
  with errors in the console is not a pass.

With `verification.uiEvidence: "required"`, every UI claim needs direct browser
evidence, including a screenshot and the relevant console and network check. If
that evidence path is unavailable, mark the claim unverifiable instead of
passing it from build output. With `when-available`, use the strongest available
evidence and report any gap plainly.

## Step 4 - report

Give a short, honest verdict, one line per checklist item:

    [pass] Download PDF saves certificate-<slug>.pdf - file downloaded, opened to the cert
    [pass] Both buttons show a loading state - screenshot: loading-state.png
    [fail] PDF border missing - printBackground not set; screenshot: pdf-no-border.png
    [skip] Vercel render - can't verify locally (feature 9)

Then state the bottom line: are all the feature's done-whens proven, or not yet.

- All proven -> update only the `**Status:**` line in
  `blueprint/context/current-feature.md` to `verified`, then say it is ready for
  `/complete`.
- Anything failed -> update only that status line to `verification failed`, then
  hand back to `/implement`; name what to fix. Do not fix it here.
- Anything unverifiable -> update only that status line to `verification
  incomplete`, then say why; never report it as a pass.

The status-line update is generated workflow state, not a product-source edit.
Do not change the spec, checkboxes, findings, or product files from `/check`.

## Rules

- **Observe product behavior, don't repair it.** `/check` changes only the
  current spec's status line as described above. It never edits product source,
  commits, or merges. Fixing is `/implement`'s job.
- **Evidence or it didn't happen.** Every `pass` is backed by something observed -
  a screenshot, output, a response. No assumed passes from reading the code.
- **Honest over green.** "Couldn't verify" and "failed" are valid, useful results.
  Faking a pass defeats the entire gate.
- **Check the spec, not vibes.** Verify against the done-whens in
  `current-feature.md`, so "works" means what the spec said it would do.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
