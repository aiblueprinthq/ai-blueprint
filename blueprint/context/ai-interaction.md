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
@blueprint/context/current-feature.md. `blueprint/workflow.md` is the reference
for the loop, each skill, configuration, and the automation modes; read it when
the work needs workflow detail.

The skills are the structured path, not a requirement. You can also just describe
a feature, fix, or change in chat at any time and we'll build it the same way;
the same rules apply (small steps, a reviewable diff, the conventions in
`coding-standards.md`). Use the skills when you want the repeatable loop and the
logging; prompt directly when you just want something done.

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

A new branch for every feature or fix, using the prefixes in
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
