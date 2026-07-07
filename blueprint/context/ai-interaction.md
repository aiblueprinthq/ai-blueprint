# AI Interaction Guidelines

> **This blueprint is an overlay layer**, added on top of an already-scaffolded
> app. Never run a framework scaffolder (create-next-app, etc.) inside this
> directory. For a new project, scaffold the app first, then overlay these files.

## Communication

- Be concise and direct
- Explain non-obvious decisions briefly
- Ask before large refactors or architectural changes
- Don't add features not in the project spec
- Never delete files without clarification

## Output formatting

Format every response for fast scanning, in whatever tool renders it. The skills
point at this file for formatting, so tune this to taste and the change applies
everywhere.

- **Real markdown, not prose walls** - bold field labels, short lines, a blank line between blocks.
- **Enumerations are lists** - a sequence of steps, options, or findings is a numbered or bulleted list, never an inline `(1)... (2)... (3)...` run crammed into a paragraph.
- **Tables for matrices** - comparing things across the same fields (status per item, option tradeoffs) goes in a table, not stacked bullets.
- **Backticks for code things** - identifiers, paths, commands, filenames.
- **Lead with the answer** - state the result or the state first, supporting detail after.
- **Don't over-format** - no deep bullet nests or decorative headers on a two-line reply. Concise still wins.

## Workflow

The loop we use for every feature. The spec for the feature being built lives in
@blueprint/context/current-feature.md.

Run `/feature` (or `/fix` for a bug or change that isn't a planned feature) to
write the spec, `/implement` to build it on a branch, and `/complete` to log it
and merge. The numbered loop below is what those skills follow.

The skills are the structured path, not a requirement. You can also just describe
a feature, fix, or change in chat at any time and we'll build it the same way; the
rules below still apply (small steps, you approve each diff, the conventions in
`coding-standards.md`), because they're always in context. Use the skills when you
want the repeatable loop and the logging; prompt directly when you just want
something done.

1. **Spec** - Optionally run `/brief` first for a read-only preview of the next
   feature (scope, dependencies, size); it writes nothing. Then run `/feature`
   (no number = the next unchecked item in `build-plan.md`) to generate
   @blueprint/context/current-feature.md, then review it together before any code.
2. **Branch** - Create a new branch for the feature/fix.
3. **Implement** - Build one small step from the spec at a time, not the whole
   feature at once.
4. **Review** - Show the diff (not full files), with a short summary: what the
   step delivered, one line per file on the why, and the done-when shown true. I
   read and approve each step before moving to the next.
5. **Test** - Verify the done-when with evidence: the browser/a screenshot and
   the project's build command (see Commands in `AGENTS.md`). If the project
   declares a `test` command in `AGENTS.md` (the opt-in switch), a step that adds
   logic must ship a passing test and the test command must be green before the
   step is approved; UI and integration steps ride on screenshot plus build
   evidence. Run `/tests` first if the project needs a stack-native unit test
   runner added or normalized. See the Testing section of `coding-standards.md`
   for the gate.
6. **Mechanical guardrails** - Local hooks and CI call
   `scripts/guardrails/Invoke-BlueprintGuardrails.ps1` against the current diff.
   These checks look for commits on protected branches, app changes without an
   active spec, placeholder overview drift, missing external review evidence in
   strict mode, misleading agent claims, workflow changes, and early prop-drilling
   signals. Markdown review files are evidence only; the script compares them to
   git state.
7. **Try manually (optional)** - Run `/try` when you want a human walkthrough:
   what to start, where to go, what to click or run, what to expect, and what
   would count as wrong. `/check` proves behavior from the agent side; `/try`
   gives you the manual review path.
8. **Audit (optional)** - Run `/audit` when you want a read-only code quality pass
   before closing a feature or after a larger automated run. It checks for
   duplication, dead code, missing tests for logic, standards drift, and
   maintainability risks. Fixes still happen through `/implement` or `/fix`.
9. **Iterate** - If it doesn't work or needs changes, re-prompt or hand-edit and
   re-test; repeat until it works, before moving on.
10. **Checkpoint (optional)** - after an approved step `/implement` offers a quick
   choice (continue / commit a checkpoint / walk me through it / stop here) as a
   selectable popup, or in plain text when there's a lot to read first so it doesn't
   cover what you're reading. Checkpoints are optional cheap rollback points; "walk
   me through it" gives a deeper code explanation and loops back; `/complete` makes
   the real feature-level commit. Build and tests must pass before any commit.
11. **Log** - `/complete` archives the spec to `blueprint/history/features/NN-name.md` (or
   `blueprint/history/fixes/`), checks the feature off in `blueprint/build-plan.md`, and
   resets `blueprint/context/current-feature.md` to its stub.
12. **Feature commit** - `/complete` stages everything on the branch (step work
   plus the logging changes) into one conventional feature commit.
13. **Squash-merge** - `/complete` squash-merges the branch to main (explicit yes)
    and deletes it, so the feature lands as one commit. Then it must ask
    separately before pushing main; merge approval does not approve a push.

**Resuming after a context clear.** Progress lives in files, not the chat:
`current-feature.md` holds the spec with each step checked off as it's done, and git
holds the code (branch, commits, working tree). A fresh session auto-loads
`current-feature.md` through the project instructions (`AGENTS.md`, and
`CLAUDE.md` for Claude Code), so `/implement` or `$implement` just continues from
the first unchecked step - no separate save/load needed.

Do NOT commit without permission or until the build passes (and tests, if the
project has them). If the build or tests fail, fix the issues first.

Autopilot exists only as an explicit opt-in command: `/autopilot` or
`$autopilot`. Do not suggest it as the default next action. When invoked, it runs
one bounded pass without pausing after each passing implementation step. It may
create checkpoint commits on the feature or fix branch after passing steps. It
stops before `/complete`, merge, push, deploy, publish, destructive actions, or
hiding failing checks.

## Branching

A new branch for every feature/fix. Name it **feature/[name]** or
**fix/[name]**. Ask to delete the branch once merged.

## Commits

- Ask before committing (don't auto-commit)
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Never put "Generated with Claude" or any AI attribution in commit messages

## When Stuck

- If something isn't working after 2-3 attempts, stop and explain the issue
- Don't keep trying random fixes
- Ask for clarification if requirements are unclear

## Code Changes

- Make minimal changes to accomplish the task
- Don't refactor unrelated code unless asked
- Don't add "nice to have" features
- Preserve existing patterns in the codebase
- For visual or replication features (recreating a design, matching a mockup),
  work from a reference image stored in `blueprint/reference/`, not a prose
  description. Ask for the image if it's missing; building a visual target from
  words alone yields an approximation that costs rework.

## Code Review

Review AI-generated code periodically, especially for:

- Security (auth checks, input validation)
- Performance (unnecessary re-renders, N+1 queries)
- Logic errors (edge cases)
- Patterns (matches existing codebase?)

## Mechanical Guardrails

The Blueprint includes optional local hooks and a CI workflow that enforce the
diff-level workflow:

- Install hooks with `pwsh scripts/guardrails/Install-GitHooks.ps1`.
- Run the same checks locally with
  `pwsh scripts/guardrails/Invoke-BlueprintGuardrails.ps1 -Mode ci`.
- Generate an external AI review with
  `pwsh scripts/guardrails/Request-ExternalAiReview.ps1` after setting
  `BLUEPRINT_AI_REVIEW_CMD`.
- CI sets `BLUEPRINT_REQUIRE_EXTERNAL_AI_REVIEW=1`, so pull requests need
  `blueprint/reviews/current-diff-review.md` to contain a real review rather than
  the placeholder.

These scripts are intentionally diff-based. They do not trust the current chat.
They compare review artifacts and agent claims against git state so shortcuts,
hallucinated "tests passed" claims, scope drift, and unreviewed workflow changes
show up before merge.
