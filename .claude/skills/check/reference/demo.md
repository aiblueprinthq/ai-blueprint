# Check demo - watched demo

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

Where this sits in the workflow:

    /check, /check guide  ->  [check demo]  ->  the user's decision
    (proof, written path)     (watch it run    (commit, land, or
                               live)            keep working)

`/check demo` runs the work's Try It Now path live in a browser the user can
watch, narrating each step in chat before and after it acts. It helps the user
see the feature working and understand it.

A demo is not verification. It never marks a done-when passed, never changes
the spec status, and never counts as `/check`, Verify, UI evidence, or the
user's acceptance or approval. Demo screenshots never go into receipts or the
archive. The written `## Try it now` section stays the path a person can repeat
alone; a demo never replaces it.

Demo mode writes no files and no activity state, installs nothing, and changes
no configuration. It may start and stop the documented development server and
create throwaway data in a local development database, nothing more.

## Input

Optional scope:

- no argument: the active feature or fix in
  `blueprint/context/current-feature.md`
- `latest`: the most recent archive under `blueprint/history/features/` or
  `blueprint/history/fixes/`
- an archive path under `blueprint/history/`: that archive
- a step or route: narrow the demo to that part of the path

If there is no active work and no useful archive, ask what the user wants to
see instead of guessing.

## Step 1 - find the path

For `latest` or an archive path, use that archive's `## Try it now` section
even when an active spec exists. Otherwise reuse a `## Try it now` section already produced for this
work in the current session. When there is none, follow
`../../check/reference/try-it-now.md` to write one from `AGENTS.md` and the
active spec.

When the work has no safe, meaningful Try It Now path, say so and stop. Never
invent a path to have something to show.

## Step 2 - decide whether it can run live

Run a live demo only when all of these hold:

- **Web UI path.** The path drives a web UI. A path that mixes UI steps with
  commands, such as a curl line, qualifies; run the commands yourself and show
  their output in chat. A pure CLI, API, library, file, configuration, or data
  path does not qualify.
- **A browser the user can see right now.** For example an agent app's
  built-in browser pane, the user's own browser through an extension, or a
  headed browser window on their screen. A headless browser, or one on a remote
  or cloud machine the user cannot see, does not count. When you cannot tell,
  ask the user once.
- **Local development only.** The app runs on a local development host, such
  as `localhost`, `127.0.0.1`, or a `.localhost` or `.test` name, from commands
  documented in `AGENTS.md`. Never demo against production, staging, or any
  shared environment.
- **Nothing real at stake.** The path needs no real credentials, payment
  details, or secrets; no real external sends such as email, chat messages,
  webhooks, payments, or paid API calls; no destructive data operation such as
  a reset, migration, or delete beyond data the demo itself created; and no
  install.

When any condition fails, fall back: print the written `## Try it now` section
with one line saying why there is no live demo. Start nothing.

## Step 3 - set up and say what's coming

Reuse a running development server; otherwise start the documented one, the
same way `/check` does. Use a throwaway local account and obviously fake data,
created for the demo or taken from the project's documented seed or fixtures.
Never enter the user's real credentials.

Prefer a browser that is separate from the user's personal sessions. If the only
browser the user can see is their own, open a new tab on the local URL and do
not use their existing sign-ins or other tabs.

Before the first step, tell the user in one short paragraph:

- what you will show, the URL, and the throwaway account
- anything that will look odd, especially test seams such as a fake clock,
  stubbed email, or seeded data. A clock moved only on the server, for example,
  can make relative times in the UI, such as "3 minutes ago", read oddly.
- any part of the path the demo cannot show live, such as an email that would
  go to a real inbox

## Step 4 - narrate each step

For each step of the path:

1. **Before acting,** say in one line what you are about to do and what should
   appear.
2. Act in the browser, or run the step's command.
3. **After acting,** say in one line what happened. Share a screenshot in chat
   when the screen changed in a way that matters and the runtime can show one.

Do not ask permission before each step. Keep a steady pace and stop the moment
the user says stop. Follow the written path; if the user asks to see more,
follow their lead within the same rules.

When the path needs time to pass, use only a documented way to move time, such
as a test clock. Otherwise say how long the wait is and wait. Never invent a
test seam.

Describe what you did and what appeared. Never say a step passed, was verified,
or is proven.

## Step 5 - stop on a mismatch

When what appears does not match what the path says should appear, stop. Show
the screenshot and say what was expected and what appeared. Retry once only when
the cause is clearly the demo's own driving, such as a misclick or a page that
had not finished loading. Never fix or debug from demo mode; point to `/debug`
to find the cause or `/implement` to repair it.

A demo cannot pass anything, but a mismatch it shows is real. A calling workflow
treats it as a blocker.

## Step 6 - close

End with one line: this was a demo, not a check, and it did not mark anything
verified or count as the user's sign-off. Stop any server the demo started and
leave a reused one running. Mention any throwaway data the demo left in the
local database.

When run on its own, finish with the written `## Try it now` section so the user
can repeat the path alone. When a calling workflow already shows that section,
do not repeat it.

## Formatting

Follow `blueprint/context/ai-interaction.md`. Keep each narration line short.
Share one screenshot per meaningful screen change, not one per action.
