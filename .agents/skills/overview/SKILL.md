---
name: overview
description: Validate and normalize project-plan.md and build-plan.md, then generate the durable project-overview.md used by agents. Use for /overview, plan cleanup, generating the first overview, or refreshing context after either plan changes.
---

# overview - turn the two plans into the AI-facing source of truth

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

**First action:** Before project inspection, preflight, or any other tool call,
publish `running` to `blueprint/.state/run.json` when `blueprint/.state/`
exists. From the project root, run the first helper that exists,
`node .agents/skills/doctor/scripts/run-state.mjs` or
`node .claude/skills/doctor/scripts/run-state.mjs`, with `start --command
<skill> --summary "<truthful summary>" --boundary
<read-only|reviewed|local-only>`. Use `update` at milestones, with `--status
blocked --resume <command>` for a blocker, and `finish --status ready|completed`
at the end; `--help` lists every option and `blueprint/workflow.md` has the full
activity contract. A missing or failing helper is a warning, not a blocker.

Where this sits in the workflow:

    project-plan.md  +  build-plan.md  ->  [this skill]  ->  project-overview.md  ->  /feature  ->  build
    (what & why,         (high-level                          (compact product         (one spec
     written by you)      feature list,                        context loaded            at a time)
                          written by you)                      on demand)

You provide two files: `blueprint/project-plan.md` (what & why) and
`blueprint/build-plan.md` (the ordered feature list), drafted directly, through
any AI conversation, or with the optional `/discovery` skill. What matters is
that you own their content. `/discovery` is never required. Everything else in
the workflow is generated from those two. This skill is the first generation
step: it distills both plans into `blueprint/context/project-overview.md`, the
compact doc workflow skills load on demand when they need durable product
context.

## Input

The two planning docs, already written:

- `blueprint/project-plan.md` - problem, users, features, data, tech,
  monetization, UI/UX, deployment, and optional usage model
- `blueprint/build-plan.md` - the ordered, one-line-per-feature list; bullets,
  numbered lists, and clearly separated feature lines are accepted

If `project-plan.md` is missing or still a placeholder, ask the user to supply
their project decisions. This skill distills plans; it does not invent them.
For a missing or placeholder-only build plan, follow Step 2's reviewed
reconciliation instead of generating an overview without a real feature list.

Placeholder text means the blueprint template's own scaffolding, not real
content: unchanged starter instructions, legacy checklist items like `Feature
one` / `Feature two`, a trailing `- description`, `TODO`, `TBD`, or the template's
example bullets left in place. Starter instructions are not features.
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

**Format clear feature lists automatically.** Invoking `/overview` authorizes
syntax-only formatting without an extra approval pause. Convert plain bullets,
ordinary numbered lists, or clearly separated feature lines into tracked
numbered checkboxes, such as `- [ ] 1. Save an article`. A valid tracked checklist
stays byte-for-byte unchanged.

Preserve wording, order, feature count, notes, headings, nesting, existing IDs,
and completion markers, including `[X]`. Add only missing tracking syntax:

- Preserve explicit numbered identities, including lettered child IDs.
- Give unnumbered features unused IDs. Check the existing plan, active work, and
  archived feature identities first; never renumber existing items or reuse an
  ID from history or active work.
- Keep child relationships and attached notes intact. Do not turn nested notes
  into features or flatten the hierarchy.
- You may remove unchanged shipped starter guidance only. Preserve user notes.

Ask for clarification before editing when structure, identities, scope, or build
order are unclear, including duplicate IDs or ambiguous feature boundaries.
Adding, removing, splitting, combining, reordering, or changing feature meaning
requires a user decision; none is syntax-only formatting. Flag vague items,
oversized bundles, pre-build setup chores, and disagreements between the two
plans instead of silently rewriting them. Minor gaps that do not affect scope or
build order can remain in the final report.

**Missing or stub build plan.** If `build-plan.md` is missing, empty, or only
starter guidance/placeholders while `project-plan.md` lists real features,
propose a checklist derived from those features and wait for approval before
writing it. This is reviewed reconciliation, not automatic formatting. If
neither plan supplies real features, ask the user for their feature list; never
invent one. Do not generate the overview while the build plan remains missing
or a stub.

Save the formatted checklist or approved reconciliation in `build-plan.md`
before generating the overview. Briefly report any formatting performed.
Formatting authority does not change Git or other approval gates.

## Step 3 - synthesize the overview

Write `blueprint/context/project-overview.md` (create `blueprint/context/` if needed), following
`reference/project-overview-template.md`. The overview is a consolidation, not a
copy:

After the title, write a plan fingerprint in this exact form:

```text
<!-- blueprint:source-hash <sha256> -->
```

Read the final saved plan bytes after any formatting or approved reconciliation.
Before hashing, normalize only build-plan completion markers by replacing each
`- [x]` or `- [X]` marker with `- [ ]`, while preserving indentation and every
other byte. Compute `<sha256>` from the exact UTF-8 bytes of `project-plan.md`,
one zero byte, then the normalized UTF-8 bytes of `build-plan.md`. This lets
`/status` detect real plan changes after cloning, copying, or updating without
treating completed features as overview drift. Replace the previous marker every
time this skill regenerates the overview.

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
- **Carry confirmed usage constraints forward.** Preserve established scale,
  reachability, trust, tenancy, security, compliance, availability, audit
  constraints, and explicit non-requirements in a compact Usage model section.
  Omit it when the usage-model section, section 9 in the shipped worksheet, is
  absent, unanswered, or contains only worksheet prompts. Never turn missing
  usage facts into enterprise, hostile, multi-tenant, or single-user requirements.
- **Stay faithful.** Don't add features, data, or stack choices that aren't in
  the plans. If something is underspecified, leave a clearly marked `> TODO`
  rather than inventing an answer.
- **Keep the overview compact.** Never copy long plan passages. The generated
  overview must remain below 20,000 bytes. Measure it before the final handoff.
  If a draft is larger, compact narrative and repeated lists while preserving
  concrete contracts, build order, and constraints. If those distinct facts
  cannot fit, stop and identify which plan section needs to be split or moved to
  a focused reference instead of writing an oversized overview.
- **Write one generated context file.** This skill writes
  `blueprint/context/project-overview.md`, the syntax-only build-plan formatting
  above, and any separately approved plan changes only.
  Never create additional generated context files such as `data-model.md`,
  `architecture.md`, or `open-questions.md` unless the user explicitly requests
  a separately scoped artifact.

Report what you wrote and list any contradictions or gaps you found between the
two plans, so the user can fix the plans and re-run. Then apply the initial
planning baseline handoff below before giving the next-step guidance.

In the next-step guidance, keep `/feature` as the main path. If the UI direction
still feels unsettled, also mention that `/prototype` is available before
`/feature`: it writes throwaway static HTML/CSS mockups to `prototypes/` and does
not modify the main app code.

## Step 4 - offer the initial planning baseline commit

During the initial pre-feature overview phase, offer to commit the approved
Blueprint setup and plans before Feature 1 starts. This keeps installation,
onboarding, planning, and the generated overview out of the first feature
commit. Never create this commit silently.

Treat this as the initial pre-feature state only when all of these are true:

- the project is a Git repository with an existing `HEAD` commit
- the current branch is the default branch, or it is a dedicated setup branch
  whose starting commit exactly matches the current default-branch tip
- the version of `blueprint/context/project-overview.md` in `HEAD` does not
  already contain a `blueprint:source-hash` marker
- `blueprint/context/current-feature.md` is still the canonical empty stub
- `blueprint/history/features/`, `fixes/`, and `rollbacks/` contain no archived
  work beyond their shipped `README.md` placeholders
- `blueprint/build-plan.md` contains no checked feature items
- the Blueprint workflow is meant to be committed, not kept local-only

If there is no `HEAD` yet, stop and send the user back to `/onboard`, which owns
the initial scaffold commit recovery. Overview never creates a root commit. If a
dedicated setup branch did not start at the current default tip, stop with that
exact mismatch. These are recoverable initial handoffs, not permission to offer
another baseline after one is committed.

Detect local-only mode with Git, not memory. Use `git check-ignore` on the
present workflow paths. If `.agents/`, `.claude/`, `blueprint/`, or `CLAUDE.md`
are ignored as part of the onboarding local-only choice, skip the offer and
continue to the normal `/feature` guidance. `AGENTS.md` remaining public does not
make a local-only setup eligible.

Before asking, record the resolved default branch and its exact tip:

1. Read `git status`, the staged diff, the unstaged diff, and untracked paths.
2. Build a candidate containing only Blueprint installation, adapter,
   configuration, planning, context, and onboarding changes under `AGENTS.md`,
   `CLAUDE.md`, `.agents/`, `.claude/`, and `blueprint/`. Include `.gitignore`
   only when every changed hunk is clearly an onboarding or Blueprint ignore
   entry.
3. Include the installer-owned `blueprint/.state/manifest.json` and
   `blueprint/.state/.gitignore` when present. Exclude transient state such as
   `run.json`, backups, and staging, plus secrets, logs, caches, dependencies,
   build output, and application source.
4. Stop if any staged change or dirty path falls outside the candidate, or if an
   allowed file contains an unrelated hunk. Do not mix app scaffolding or other
   user work into this commit. Tell the user exactly what must be committed,
   moved, or restored first, then leave the repository unchanged.
5. If the candidate is empty, skip the offer.
6. Show the exact candidate paths and their diff before asking:
   `Finalize the Blueprint baseline locally? (Recommended)`
   State that accepting creates one local commit. When running on a dedicated
   setup branch, it also fast-forwards the unchanged default branch to that
   commit, returns to the default branch, and deletes the setup branch. It never
   pushes.

If the user accepts, stage only the reviewed candidate, show the staged paths
and diff summary, verify no other path is staged, and commit with this exact
message:

```text
chore: establish Blueprint project baseline
```

For a dedicated setup branch, verify before committing that the default tip is
still the one shown in the prompt. After the commit, require a clean working
tree, switch to the default branch, run `git merge --ff-only <setup-branch>`, and
delete the setup branch locally. The single approval above covers only these
named local actions. If the default moved or any check fails, stop without
merging or deleting. Then confirm the final branch and working tree and recommend
`/feature`.

If the user declines, leave the repository untouched and explain what remains.
Do not offer this baseline on later overview reruns once `HEAD` already contains
a generated overview or feature work has begun.

## Rules

- **Generated, not authored.** Treat `project-overview.md` as a build artifact of
  the two plans. When the plans change, re-run this skill rather than hand-editing
  the overview.
- **Plans are user-owned.** Automatic formatting changes tracking syntax only.
  Preserve the user's decisions and existing tracking state. Changes to plan
  content and missing-plan reconciliation require approval.
- **Discovery is not a gate.** Never require `/discovery` or treat directly
  written plans as lower quality because the skill was not used.
- **Build plan must be trackable.** Save the real numbered checklist before
  generating the overview and its fingerprint. The real feature list must never
  live only in the overview - `/feature` reads `build-plan.md`, not the overview.
- **No new scope.** Everything in the overview must trace back to one of the two
  plans. Invented scope is the main failure mode here.
- **Concrete over vague.** Field-level data models and named routes beat
  restating the plan's one-liners.
- **Surface conflicts.** Always end by reporting disagreements between the plans;
  silent reconciliation hides decisions the user should make.
- **One reviewed baseline.** Offer the initial planning commit once, immediately
  before Feature 1, and only after showing its exact scope. Never treat an
  overview rerun as permission to commit.

## When to re-run

Re-run whenever `project-plan.md` or `build-plan.md` changes materially - a new
feature, a changed data model, a different stack. The overview is downstream of
the plans and should be regenerated, not patched.

## Formatting

Format the output to match the project's conventions in
`blueprint/context/ai-interaction.md`: concise, scannable markdown, with lists for
enumerations and tables for matrices rather than dense paragraphs.
