---
name: discovery
description: "Optional deep, multi-turn project discovery that helps the user develop detailed Blueprint project-plan.md and build-plan.md files through an adaptive conversation, then drafts them only after the user says they are ready. Use when the user explicitly runs /discovery or $discovery, asks for a guided planning interview, wants to think through a new product before writing the plans, or wants help deepening existing plans. Do not use merely because planning files are empty, after /onboard, or before /overview; users may always write the plans directly or create them through any conversation they prefer."
---

# discovery - develop the plans through a deep conversation

Where this can sit in the workflow:

    /onboard  ->  write the plans directly  ->  /overview
              \
               ->  [discovery]  ->  review and approve plan drafts  ->  /overview

`/discovery` is an optional planning partner, not a required workflow gate and
not a quick questionnaire. It can span as many turns as the project needs. Its
job is to help the user think through the product, preserve the depth and nuance
of that conversation, and draft the two user-owned planning files only when the
user asks for drafts.

Running `/onboard` never starts this skill. Empty plans never require it. A user
who writes detailed plans manually, has another AI conversation, or arrives with
finished plans continues directly to `/overview` exactly as before.

## Step 1 - establish the starting point

Read only the planning and project facts needed for the conversation:

- `blueprint/project-plan.md`
- `blueprint/build-plan.md`
- the root project manifest, README, and framework configuration when they
  already contain relevant facts
- `blueprint/context/project-overview.md` only when the user is revisiting an
  established project's direction

Classify each planning file as a template, partial draft, or substantive plan.
Never treat existing user content as disposable. When either plan has real
content, summarize what it already establishes and ask whether the user wants to
deepen it, revise a specific direction, or use it unchanged as conversation
context. Do not replace it with a fresh generic plan.

Start with a short working hypothesis about the project and name the most
important unknown. Then ask one focused question. Do not draft either plan yet.

## Step 2 - run adaptive discovery

Ask one meaningful question at a time and let each answer shape the next one.
Prefer a likely interpretation the user can correct over a vague request for
more detail. Explain a tradeoff when the answer would materially change scope,
architecture, cost, or build order.

Cover the areas that matter to this project, not a fixed questionnaire:

- problem, desired outcome, and why the project should exist
- target users, their context, and their primary workflows
- MVP capabilities, explicit non-goals, and later possibilities
- business rules, data, integrations, permissions, and important edge cases
- stack choices, constraints, dependencies, and technical unknowns
- UI/UX direction, accessibility needs, and useful references
- monetization or business model when relevant
- deployment shape, environments, background work, storage, and operations
- risks, assumptions, unresolved decisions, and how success will be judged
- feature boundaries, dependencies, and a sensible build order

Depth is the goal. Follow a consequential answer until its implications are
clear instead of racing to the next category. Do not ask the user to repeat facts
already established in the conversation or repository. Do not force irrelevant
topics merely to complete a checklist.

Periodically return a compact discovery snapshot with:

- confirmed decisions
- working assumptions that still need confirmation
- open questions or conflicts
- ideas explicitly deferred or excluded

The snapshot keeps a long conversation coherent. It is not permission to write
the plans.

## Step 3 - decide whether the plans are ready

Do not end discovery because a preset number of questions has been reached. It
is ready to draft when:

- the problem, users, and core workflows are concrete
- MVP scope and non-goals are distinguishable
- data and technical choices are detailed enough to expose major dependencies
- the build order can be expressed as feature-sized outcomes
- important contradictions are resolved
- remaining unknowns are either safe to defer or explicitly accepted as TODOs
- the user says they are ready for the plans to be drafted

If the user asks for drafts while a material gap remains, name the gap and ask
whether to continue discovery or preserve it as an explicit TODO. Respect the
choice. The user may also stop at any time and write the plans manually.

## Step 4 - draft both planning files

When the user asks for drafts, produce complete proposed contents for both files
without writing them yet.

For `blueprint/project-plan.md`:

- keep the template's main subject areas, adding useful sections when the
  conversation requires them
- preserve rationale, examples, tradeoffs, constraints, edge cases, and
  exclusions that will matter during later feature work
- be as detailed as the project needs; never compress a rich discovery into a
  line or two per section
- distinguish confirmed decisions from assumptions and TODOs

For `blueprint/build-plan.md`:

- use numbered checkboxes and optional milestone headings
- keep each item a high-level, feature-sized outcome with a concise description
- order items by dependency and the earliest useful vertical slice
- keep implementation detail in later `/feature` specs rather than turning the
  roadmap into a task dump
- include only agreed scope; place deferred ideas outside the MVP or omit them as
  the user directed

If substantive plans already exist, preserve their information and completed
build-plan numbering. Clearly identify proposed additions, removals, or changed
decisions.

End by asking the user to review the full drafts. Do not write either file in the
same response that first presents them.

## Step 5 - write only after approval

Write the approved drafts only after the user explicitly approves them. If the
user requests changes, revise the drafts and show the affected sections again
before writing.

After writing:

- report which files changed
- list any retained TODOs or unresolved decisions
- remind the user that both files remain theirs to edit and deepen directly
- stop before generating `blueprint/context/project-overview.md`
- point to `/overview` or `$overview` as the next optional command when the user
  is satisfied with the plans

## Rules

- This skill is always optional. Never make it a prerequisite for `/overview`,
  `/feature`, or any other Blueprint command.
- Never start it automatically from `/onboard`, because planning files are
  empty, or because a project is new.
- Never imply that plans created manually or through another conversation are
  inferior or incomplete merely because this skill was not used.
- Never overwrite substantive planning content without showing the replacement
  and receiving explicit approval.
- Never write plans during the interview or after a vague signal such as "looks
  good." The user must explicitly approve the proposed file contents.
- Never scaffold the app, edit product code, generate the overview, create a
  feature spec, commit, merge, push, or deploy.
- Preserve detailed project reasoning in `project-plan.md`, while keeping
  `build-plan.md` high-level and trackable.
- Keep the conversation adaptive. Depth comes from relevant follow-up questions,
  not from mechanically asking every possible question.

## Formatting

Follow `blueprint/context/ai-interaction.md`. During discovery, ask one focused
question per turn. For snapshots and draft reviews, use concise headings and
lists so confirmed decisions and remaining gaps are easy to inspect.
