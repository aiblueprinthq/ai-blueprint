# Blueprint Reviews

This directory stores review evidence produced outside the implementation
session.

## Files

- `current-diff-review.md` - external AI or human review of the current diff.
- `agent-claims.md` - optional structured claims from the implementing agent.

These files are evidence, not source of truth. Scripts compare them against the
actual diff and command output so an agent cannot claim a passing check or a
small scope without evidence.

## External AI review

Set `BLUEPRINT_AI_REVIEW_CMD` to a command that accepts the review prompt on
stdin and writes review markdown to stdout. Then run:

```powershell
pwsh scripts/guardrails/Request-ExternalAiReview.ps1
```

In CI, set `BLUEPRINT_REQUIRE_EXTERNAL_AI_REVIEW=1` to make the review artifact a
hard gate for pull requests.
