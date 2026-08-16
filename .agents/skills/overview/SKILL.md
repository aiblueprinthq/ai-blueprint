---
name: overview
description: "Validate and, when needed, normalize the two planning docs before generating blueprint/context/project-overview.md from blueprint/project-plan.md and blueprint/build-plan.md. The overview is the single AI-facing source of truth that project instructions load every session. Use when the user runs /overview, invokes $overview, has just finished writing or editing the plans, asks to shape rough plans into the Blueprint format, or asks to regenerate the project overview."
---

# overview - turn the two plans into the AI-facing source of truth

Where this sits in the workflow:

    project-plan.md  +  build-plan.md  ->  [this skill]  ->  project-overview.md  ->  /feature  ->  build
    (what & why,         (high-level                          (the one doc the         (one spec
     written by you)      feature list,                        AI reads every           at a time)
                          written by you)                      session)

You provide two files: `blueprint/project-plan.md` (what & why) and
`blueprint/build-plan.md` (the ordered feature list), drafted directly, through
any AI conversation, or with the optional `/discovery` skill. What matters is
that you own their content. `/discovery` is never required. Everything else in
the workflow is generated from those two. This skill is the first generation
step: it distills both plans into `blueprint/context/project-overview.md`, the
single doc project instructions load at the start of every session.

## Input

The two planning docs, already written:

- `blueprint/project-plan.md` - problem, users, features, data, tech,
  monetization, UI/UX, deployment
- `blueprint/build-plan.md` - the ordered, one-line-per-feature build checklist

If either is missing or still has placeholder text, stop and tell the user to
fill it in first. This skill distills plans; it does not invent them.

Placeholder text means the blueprint template's own scaffolding, not real
content: checklist items like `Feature one` / `Feature two`, a trailing
`- description`, `TODO`, `TBD`, or the template's example bullets left in place.
Watch for the masking trap in particular: `build-plan.md` can still be the stub
while `project-plan.md` §3 already lists the real features. When that happens the
overview can be synthesized from `project-plan.md` alone and come out looking
complete, hiding the empty checklist that `/feature` actually reads. A rich
`project-plan.md` must not paper over a stub `build-plan.md` - reconcile the
checklist first (Step 2) rather than generating over the gap.

## Step 1 - read both plans

Read `project-plan.md` and `build-plan.md` in full. Note where they disagree - a
feature in the build plan the project plan never mentions, a data point no
feature uses, a stack choice that contradicts a standard. You will surface
these, not paper over them.

## Step 2 - validate plan shape

Before writing `project-overview.md`, check that the plans are shaped well enough
to drive the build loop.

`build-plan.md` should be:

- a numbered checkbox list using `- [ ]` or `- [x]`
- one feature-sized outcome per line
- ordered roughly from first useful slice to later integrations and hardening
- specific enough for `/feature` to turn the item into a spec
- free of pre-build setup items such as scaffolding the app, installing the
  framework, or prototyping the look

Flag these as plan-shape problems:

- plain bullets with no checkboxes
- vague items like "database", "auth stuff", "make it nice", or "admin"
- giant items that bundle many features together
- implementation chores instead of user-visible or system-visible outcomes
- feature lists in `project-plan.md` that do not match `build-plan.md`

**Stub build plan, real project plan (hard stop).** If `build-plan.md` is still
the template stub or otherwise placeholder-only while `project-plan.md` §3 lists
real features, do not generate the overview from `project-plan.md` alone. Derive
the ordered checklist from `project-plan.md`'s feature list, show it, and on
approval write it into `build-plan.md` before continuing. This is faithful, not
invented scope - the features are already the user's, they were just never
transcribed into the tracked checklist. The overview is generated from
`build-plan.md`, so `build-plan.md` must hold the real feature checklist first;
never leave it a stub sitting behind a complete-looking overview.

If the build plan is rough but understandable, propose a cleaned-up checkbox
version and stop for user approval before editing the plan or generating the
overview. Keep the proposal faithful to the user's scope; sharpen wording and
split obvious bundles, but do not add new features.

If the user explicitly asked you to clean up the plans in the same request, you
may update `build-plan.md` after showing the normalized version. Otherwise, stop
and ask for approval.

If the issues are minor and do not affect build order, continue and list them
under Open questions or gaps in the final report.

## Step 3 - synthesize the overview

Write `blueprint/context/project-overview.md` (create `blueprint/context/` if needed), following
`reference/project-overview-template.md`. The overview is a consolidation, not a
copy:

- **One source of truth.** Merge both plans into one coherent document. After
  this runs, the AI reads the overview, not the raw plans.
- **Make the data model concrete.** Turn the plan's data list into actual
  models with fields, types, and relationships, derived from the features that
  use them. This is the most valuable thing the overview adds.
- **Tie features to build order.** List the features with a one-line purpose
  each, in build-plan order, so the AI knows what exists and what's next.
- **Carry deployment constraints forward.** If the plan names Render, Vercel,
  build commands, env vars, health checks, or provider constraints, include them
  in a short Deployment section. If deployment is unknown, mark it `> TODO`.
- **Stay faithful.** Don't add features, data, or stack choices that aren't in
  the plans. If something is underspecified, leave a clearly marked `> TODO`
  rather than inventing an answer.

Then stop. Report what you wrote and list any contradictions or gaps you found
between the two plans, so the user can fix the plans and re-run.

In the next-step guidance, keep `/feature` as the main path. If the UI direction
still feels unsettled, also mention that `/prototype` is available before
`/feature`: it writes throwaway static HTML/CSS mockups to `prototypes/` and does
not modify the main app code.

## Rules

- **Generated, not authored.** Treat `project-overview.md` as a build artifact of
  the two plans. When the plans change, re-run this skill rather than hand-editing
  the overview.
- **Plans are user-owned.** Do not silently rewrite `project-plan.md` or
  `build-plan.md`. Propose normalized plan text and stop for approval unless the
  user explicitly asked you to clean up the plans.
- **Discovery is not a gate.** Never require `/discovery` or treat directly
  written plans as lower quality because the skill was not used.
- **Build plan must be trackable.** Prefer a numbered checkbox list. If the build
  plan is raw bullets, or still a stub while `project-plan.md` lists the features,
  normalize it and write the reconciled checklist back into `build-plan.md` before
  generating the overview. The real feature list must never live only in the
  overview - `/feature` reads `build-plan.md`, not the overview.
- **No new scope.** Everything in the overview must trace back to one of the two
  plans. Invented scope is the main failure mode here.
- **Concrete over vague.** Field-level data models and named routes beat
  restating the plan's one-liners.
- **Surface conflicts.** Always end by reporting disagreements between the plans;
  silent reconciliation hides decisions the user should make.

## When to re-run

Re-run whenever `project-plan.md` or `build-plan.md` changes materially - a new
feature, a changed data model, a different stack. The overview is downstream of
the plans and should be regenerated, not patched.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
