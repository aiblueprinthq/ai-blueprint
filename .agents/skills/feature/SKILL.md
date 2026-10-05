---
name: feature
description: Turn the next, named, or numbered build-plan feature into a buildable current-feature.md spec with small steps and done-when criteria. Use for /feature, planning a feature, or starting planned work.
---

# feature - create the active implementation spec

**Context reuse:** Reuse any required file already loaded in project instructions or the current session. Read it again only if absent, changed, or exact current bytes or line references are needed.

This skill plans one feature and stops before implementation. Its output is
`blueprint/context/current-feature.md`.

## Start

**First action:** Before project inspection, preflight, or any other tool call,
publish the `feature` activity as `running` when `blueprint/.state/` exists.
Combine that write with the first context-gathering tool batch when the adapter
supports it.

Read `blueprint/config.json` only for settings that affect the spec. Invalid
configuration stops mutating work and points to `/doctor`.

Confirm that `blueprint/context/current-feature.md` is the empty stub. If it
contains active work, stop and direct the user to resume or complete it. Never
replace another worker's active spec. Parallel work uses one clone or Git
worktree per work item, with a separate branch in each checkout.

Resolve the target from `blueprint/build-plan.md`:

- Use the requested number or name when it matches a checklist item.
- With no argument, use the first unchecked leaf item.
- Read only the matching checklist line, its parent, and nearby text needed to
  understand the hierarchy.
- If a plain list has no checkboxes, treat its first item as unchecked and offer
  to convert the plan after the spec review.

State the selected feature in one sentence.

## Build one authoritative feature packet

Gather the smallest packet that can answer what must be built:

1. Search `blueprint/context/project-overview.md` for the feature number, title,
   and distinctive nouns from the target line. Read the matching feature
   passage plus only the usage-model, data-model, stack, UI, security, or
   deployment passages it directly depends on. Do not read the whole overview
   by default.
2. Inspect the repository once, starting from paths named by those passages.
   Follow only relevant imports, callers, tests, schemas, and configuration.
   Batch related searches and reads when supported.
3. Use the Commands section already loaded from `AGENTS.md`. Read it from disk
   only when it is absent or changed. Read only applicable sections of
   `blueprint/context/coding-standards.md`.
4. Run the declared Verify command once when it exists. Record only observed
   results. Do not start a dev server.

Finish context gathering in at most four tool rounds after this skill starts:
target and overview matches, one batched repository inspection, applicable
standards only if needed, and Verify. Combine or skip rounds when possible. Do
not inspect other skill directories, `ai-interaction.md`, findings, review records,
or templates during normal planned-feature work. The only history exception is
this skill's `reference/build-history.md` and the selected feature's archive metadata,
exact rollback records, and Git evidence needed to freeze its build attempt below;
batch this with the target lookup, without loading unrelated history. Do not create
scratch code or run implementation probes while writing a spec. Put a check in the
relevant build step when a repository detail cannot be confirmed from existing
evidence.

The plans and overview define product intent. The repository defines current
reality. Do not invent presets, defaults, limits, permissions, money rules,
destructive behavior, stored fields, or API contracts. A familiar label is not a
complete contract when it has multiple reasonable meanings. Put unresolved
material choices under an `Open questions` heading and in the review handoff.
Stop without writing the spec when implementation cannot begin safely until one
is answered. Do not block on a reversible internal implementation detail with no
user-visible, security, persisted-data, or interoperability consequence. Choose
the simplest repository-native option, record it in the spec, and require a test
seam when the value is nondeterministic. Planned future persistence alone does
not make a current in-memory representation a product decision when no stored
data or external compatibility exists yet.

Apply proportional engineering before drafting: add an abstraction, dependency,
service, configuration surface, compatibility layer, or security mechanism only
when an established requirement needs it now. Prefer existing code, the standard
library, native platform features, and installed dependencies. Unknown scale or
future extensibility defaults to the smaller reversible design. Treat a trust or
data-integrity boundary as established when the repository exposes network or
untrusted input, auth/session/ownership, shared persisted data, destructive
operations, secrets, or sensitive data, even when the plans do not name it.

If `project-overview.md` is 20,000 bytes or larger, stop and ask for `/overview`
instead of loading it. If the target is too large for one reviewable branch,
propose sub-features and wait for approval before editing the user-owned build
plan. After approval, add lettered checklist items under the parent and spec only
the first one.

## New feature not in the plan

Do not silently add scope. Search for a duplicate, then propose one checkbox line
and its placement. Include a `project-plan.md` edit only when the request changes
the product direction, users, data, stack, monetization, UI, or deployment. Wait
for approval, update the plans, run the installed `overview` skill, and then
resume this skill. Bugs and small unplanned changes belong in `/fix`.

## Write the final spec once

Before review, allocate the selected stable feature ID's build attempt using
`reference/build-history.md`: first build 1, otherwise one greater than
the maximum proven prior attempt after all prior builds were reversed. Preserve
the ID across renamed titles and lettered sub-items. Stop on ambiguous history;
never infer attempts from a title suffix, file count, or timestamps.

Draft and critique in context, then write
`blueprint/context/current-feature.md` once. A later write is only for a
mechanical correction or user-requested revision. Record `**Branch:**` with the
full configured feature branch. The first heading and build-plan identity must
use this canonical form:

```markdown
# Feature: <title>

**From build-plan:** feature <id>
**Build attempt:** <positive integer>
```

Then use these section headings:

- Goal
- Design reference, only for visual or replication work
- In scope
- Out of scope
- Build loop
- Build steps
- Files / areas
- Data / contracts
- Testing
- Notes for the AI
- Open questions, only when a product decision remains unresolved

Build steps are ordered checklist items. Each step must leave the project
working, stay small enough to review, and end with a concrete `Done when` that
names observable behavior and the relevant check. Follow `workflow.stepReview`
and `workflow.checkpointCommits` from config in the Build loop. `/complete`
creates the final feature commit.

The spec must preserve every explicit contract in the feature packet, including
applicable project-wide UX and security requirements. Do not discard a required
state because the current fixture cannot trigger it yet. Keep later features out,
define authorization and tenant boundaries only when the feature packet or
reachable code establishes them, identify client and server responsibilities,
and name exact files or areas supported by repository evidence.
Add focused tests for logic when a test command exists. Add browser coverage only
when a Browser tests command exists and it is proportionate. Do not claim live,
visual, persisted-data, or integration evidence that was not run.

Build the branch value from the configured feature prefix plus the feature title
in lowercase kebab-case. Replace each run of characters other than ASCII letters
and digits with one hyphen and trim edge hyphens. For attempt N > 1, append
`--build-N` to that slug before recording the full branch, for example
`feature/export-reports--build-2`. The reserved double hyphen distinguishes the
attempt from a title ending in `Build 2`. Before freezing the new spec, check the
exact archive path and branch availability using `reference/build-history.md`.
Stop on filesystem entries, disallowed refs, or prior Git use of that archive
path; never auto-bump the attempt. The reference permits only one existing-ref
case: the pristine current branch of a pre-created parallel worktree. Freeze both
fields before review; completion and resume reuse them rather than allocating
again.

For visual replication, require an existing screenshot or reference. Store a
provided image under `blueprint/reference/` and link it. If `prototypes/` exists,
use its relevant HTML and `theme.css`; port shared tokens before feature UI.

## Critique gate

Before the single write, check these failure classes:

- Missing happy, loading, empty, invalid, denied, and unexpected-error behavior
  that applies to the feature.
- A product contract from the packet that was omitted, weakened, or contradicted.
- Scope added from guesswork or pulled forward from a later feature.
- A proposed abstraction, dependency, service, configuration surface,
  compatibility layer, or security mechanism lacks a current requirement, or
  duplicates existing code, the standard library, the platform, or an installed
  dependency. Untuned stack-specific standards in `coding-standards.md` are not
  established requirements.
- An oversized or incorrectly ordered build step.
- When an established persisted-data or external API boundary requires it, the
  contract leaves a material type, format, encoding, generator, uniqueness rule,
  default, lifecycle, serialization, or stable result and error shape implicit.
- When an established security, tenant, concurrency, destructive-operation,
  payment, or sensitive-data boundary requires it, the trusted actor source,
  repository-first tenant scope, atomicity, idempotency, or redaction behavior
  remains implicit.
- User-controlled text lacks a safe rendering rule, or validation and error
  feedback lacks the relevant label, association, announcement, focus, or
  clearing behavior.
- A new file, asset, import, or route is not reachable through the current
  runtime and server behavior.
- An authorization or URL shape later work would have to reinterpret.
- A done-when that cannot be observed or a test claim the repository cannot run.
- A prerequisite that makes the final Verify gate impossible.

If a prerequisite is absent, incomplete, untracked, or unverified, say which one
the evidence shows. Do not bury repair inside this feature. Stop with the exact
`/fix` or user decision required.

Otherwise write the tightened spec, update activity to `ready`, and stop for
review. Lead with a short note naming what the critique changed, or say that it
found no material change. Never implement from this skill.
