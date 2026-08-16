# Rollback: Feature NN - Name

**Type:** Rollback
**Target feature:** NN - Name
**Target archive:** `blueprint/history/features/NN-name.md`
**Target commit:** `<full 40-character commit SHA>`
**Target parent:** `<full 40-character parent SHA>`
**Reason:** Why this completed feature must be removed

## Goal

Restore the product behavior that existed before the target feature while
preserving Blueprint history and compatible work added afterward.

## Scope

### Reverse

- Product paths and behavior introduced or changed by the target commit

### Preserve

- The original completed feature archive
- Later build-plan and project-plan changes
- Blueprint context, adapter skills, rollback spec, and prototypes
- Later product behavior confirmed compatible in the risk review

### Out of scope

- Cascading rollbacks of later features
- Destructive data migration
- Unrelated cleanup or refactoring

## Product paths

- `path/from/target-commit`

## Later-change risk

**Classification:** No overlap | Overlap, likely compatible | Dependency risk

| Later commit | Shared path or contract | Required handling |
| ------------ | ----------------------- | ----------------- |
| `<sha> subject` | `path` or contract | Preserve, adapt, or block |

## Build steps

- [ ] Apply the target commit's product diff in reverse with the Type: Rollback
  guard in `/implement`.
  - Done when: the reverse patch applies only to product paths, protected
    Blueprint paths are unchanged, and the staged diff matches the approved
    rollback scope.
- [ ] Make only the compatibility edits approved by the risk review.
  - Done when: later features named above still compile and retain their stated
    behavior. Remove this step when no compatibility work is required.
- [ ] Run the project checks and the observable removal path below.
  - Done when: every declared build, test, and acceptance command passes, the
    removed behavior is no longer reachable, and unaffected core behavior still
    works.

## Verification

- Build: `<command from AGENTS.md>`
- Tests: `<declared test command, or not configured>`
- Removed behavior: `<route, UI action, CLI output, API, or public call that must no longer exist>`
- Regression path: `<small unaffected flow that must still work>`

## Notes for the AI

- Stop on patch conflicts or evidence of an unplanned dependency.
- Do not delete the original feature archive.
- Do not broaden this rollback beyond the product paths and compatibility work
  listed above.
