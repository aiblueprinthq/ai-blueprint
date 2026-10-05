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
write the spec and approve it before `/implement` builds it on a branch. Use
`/check` to prove behavior, `/audit` to review code and record findings, and
`/complete` to log the work and merge with approval. This teaching path does not
change the configured gates; Audit is not mandatory for every feature.
`/check guide` only explains how the user can test the work and never runs checks
or records acceptance. The numbered loop below is what those skills follow.

Before planning, `/explore <topic>` investigates an idea against the actual code
without requiring plans or writing files. `/brief` instead explains an existing
build-plan item. Run these skills in AI chat, using the `$` form in Codex, not as
terminal commands.

After the first successful `/overview`, Blueprint offers a reviewed local commit
for the initial workflow setup and plans before Feature 1. It shows the exact
candidate diff and asks first. It skips local-only installations and stops
rather than mixing app source or unrelated work into the baseline. When setup
work is on a dedicated branch, the same approval can finalize the local baseline
and fast-forward it into the unchanged default branch. It never pushes.

The skills are the structured path, not a requirement. You can also just describe
a feature, fix, or change in chat at any time and we'll build it the same way; the
rules below still apply (small steps, a reviewable diff, the conventions in
`coding-standards.md`). Project instructions tell the agent to read these files
when the work needs them instead of carrying them through every unrelated turn.
Use the skills when you want the repeatable loop and the logging; prompt directly
when you just want something done.

1. **Spec** - Optionally run `/brief` first for a read-only preview of the next
   feature (scope, dependencies, size); it writes nothing. Then run `/feature`
   (no number = the next unchecked item in `build-plan.md`) to generate
   @blueprint/context/current-feature.md, then review it together before any code.
2. **Branch** - Create a new branch for the feature/fix.
3. **Implement** - Build one small step from the spec at a time, not the whole
   feature as one undifferentiated change.
4. **Review** - By default, implement and verify each small step, then show one
   feature-level review packet with the complete diff and done-when evidence.
   Set `workflow.stepReview` to `every` when I should approve each step before
   the next one begins. After the final packet, `/implement` always offers a
   read-only walkthrough of the finished code, regardless of review cadence or
   checkpoint settings.
5. **Test** - Verify the done-when with evidence. If `AGENTS.md` declares a
   `Verify` command, run that exact command as the final automated gate. It wraps
   only the checks the project actually has. If no Verify command exists, run the
   documented build command and the test command when configured. A step that
   adds logic must ship a passing test when the test gate is on. When `AGENTS.md`
   declares `Browser tests`, stable browser behavior can include focused harness
   coverage, while remaining UI and integration claims ride on direct browser,
   screenshot, API, and build evidence. Run `/tests` or `/tests browser`
   explicitly rather than adding a missing runner mid-feature. See the Testing
   section of `coding-standards.md` for the gates.
   Run `/ci` separately when you want one Verify command and matching automatic
   GitHub checks; CI setup is not part of this feature loop.
6. **Try manually (optional)** - Run `/check guide` when you want a human walkthrough:
   what to start, where to go, what to click or run, what to expect, and what
   would count as wrong. `/check` proves behavior from the agent side; `/check guide`
   gives you the manual review path.
7. **Audit (optional)** - Run `/audit` when you want a read-only code quality pass
   before closing a feature or after a larger automated run. It checks for
   duplication, dead code, missing tests for logic, standards drift, and
   maintainability risks. Run `/audit independent current` when a selected fresh
   reviewer should inspect an approved checkpoint and leave a staleness-checked
   receipt. Regular and Continuous independent review default to
   `when-sensitive`, so sensitive or unusually broad work selects this gate
   automatically while ordinary small features do not. A `manual` gate policy
   disables automatic selection, but the explicit command remains available.
   `review.independentExecution` defaults to an automatic isolated reviewer when
   the adapter supports it; set it to `manual` for the fresh-session handoff.
   Automatic review runs after final Verify, required Check, and verified spec,
   before the final packet and `/complete`. Fixes still happen through
   `/implement` or `/fix`. The automatic path starts a generic child through the
   current runtime and instructs it from the project-local Audit skill and review
   contract. It never depends on a global role, skill, prompt, or TraversyFlow.
   The request records requested execution and the receipt records actual
   execution, including an explicit manual fallback when automatic review is not
   available.
8. **Iterate** - If it doesn't work or needs changes, re-prompt or hand-edit and
   re-test; repeat until it works, before moving on.
9. **Checkpoint (optional)** - checkpoint commits are disabled by default. When
   enabled with per-step review, `/implement` offers continue, commit a
   checkpoint, walk me through it, or stop here after an approved step. The
   checkpoints are optional rollback points; `/complete` still makes the real
   feature-level commit. Verify, or the fallback checks, must pass first. When
   implementation is done, end with a compact review packet: changed files,
   checks run, manual try path, risks, and next action. The per-step walkthrough
   is part of the Guided checkpoint prompt. The final code walkthrough is always
   available and is separate from the manual product-review path produced by
   `/check guide`.

`workflow.stepReview: "every"` restores per-step approval pauses but does not
enable checkpoint prompts by itself. The previous workflow uses
`stepReview: "every"` together with `checkpointCommits: "enabled"`.
10. **Safety + log** - `/complete` first checks the active spec, branch, changed
   files, Verify or fallback check evidence, manual try path, and adapter sync when
   workflow files changed. Then it archives the spec using its frozen build attempt:
   `blueprint/history/features/NN-name.md` for the first build and
   `NN-name--build-N.md` for rebuilds, preserving earlier archives and the stable
   plan ID (fixes use `blueprint/history/fixes/`). It checks the feature off in
   `blueprint/build-plan.md`, and
   resets `blueprint/context/current-feature.md` and
   `blueprint/context/review.md` to their stubs.
11. **Feature commit** - `/complete` stages everything on the branch (step work
   plus the logging changes) into one conventional feature commit.
12. **Land** - `/complete` follows `git.landing`. The default local path asks to
    squash-merge the branch and later asks separately before pushing the default
    branch. The `pull-request` path asks once before pushing the work branch and
    opening a pull request, then leaves provider review and squash merge to the
    user. Neither path infers approval from configuration.
13. **Release prep (optional)** - run `/release render` or `/release vercel`
    after a completed feature or milestone when you want local provider config,
    env var review, build/start checks, and a smoke-test path. `/release` must
    stop before deploy, remote service creation, remote env changes, push, or
    publish unless the user gives a separate yes in the current chat.

**Resuming after a context clear.** Progress lives in files, not the chat:
`current-feature.md` holds the spec with each step checked off as it's done, and git
holds the code (branch, commits, working tree). A fresh `/implement` or
`$implement` run loads `current-feature.md` on demand and continues from the
first unchecked step, so no separate save or load command is needed.

Do NOT commit without permission or until Verify, or the fallback build and tests,
passes. If a required check fails, fix the issue first.

Autopilot exists only as an explicit opt-in command: `/autopilot` or
`$autopilot`. Do not suggest it as the default next action. It combines
`/feature` or `/fix` with `/implement` in one bounded pass. The normal workflow
stops for human approval of the spec before implementation; an explicit
Autopilot request continues through that review point without pausing after each
passing implementation step. It may create checkpoint commits on the feature or
fix branch after passing steps. It stops before `/complete`, merge, push, deploy,
publish, destructive actions, or hiding failing checks.

Continuous Mode also exists only as an explicit opt-in command: `/continuous`
or `$continuous`. Do not suggest it as the default next action. Its explicit
invocation authorizes the local per-feature lifecycle defined by that skill:
configured checkpoint commits, one local default-branch commit per completed
feature, local squash merges, branch deletion, and repetition through the
configured limit or end of the build plan. It never authorizes push, deploy,
publish, send, remote changes, destructive actions, finding waivers, or product
decisions.

## Branching

A new branch for every feature, fix, or rollback, using the prefixes in
`blueprint/config.json`. Ask to delete the branch once merged. Continuous Mode's
explicit invocation already authorizes deletion of each locally merged feature
branch.

## Commits

- Ask before committing, except for checkpoint and feature-lifecycle commits
  explicitly authorized by `/autopilot` or `/continuous`
- The initial Overview baseline also requires explicit approval and uses
  `chore: establish Blueprint project baseline`
- Use conventional commit messages (feat:, fix:, chore:, etc.)
- Keep commits focused (one feature/fix per commit)
- Do not add AI `Co-Authored-By` trailers, generated-by signatures, or other AI
  attribution to commits or pull requests; preserve genuine human attribution

### Commit and PR attribution

Claude Code supports optional [attribution settings](https://code.claude.com/docs/en/settings-reference#attribution).
Merge these keys into `.claude/settings.json` for the project or
`~/.claude/settings.json` for [personal global settings](https://code.claude.com/docs/en/settings),
preserving all other settings in the existing JSON:

```json
{
  "attribution": {
    "commit": "",
    "pr": "",
    "sessionUrl": false
  }
}
```

Empty strings suppress the default commit trailer and PR attribution text.
`sessionUrl: false` also omits session links from cloud and Remote Control
commits and PRs. The older `includeCoAuthoredBy` setting is deprecated.

Older Codex advice to set `commit_attribution = ""` is outdated: current Codex
[no longer supports that TOML key](https://github.com/openai/codex/commit/d18a7c982e4abad5bf549cda6f4b61a18c10702e).

These settings are optional; the installer does not change your tool
configuration. Guidance and settings reduce unwanted attribution but do not
enforce commit or PR message contents. Review the final text before submitting it.

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
