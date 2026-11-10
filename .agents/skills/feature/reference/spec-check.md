# Spec check

An optional second reading of a freshly written feature spec by a reviewer that
did not write it. It looks for places where the spec no longer matches the
repository, parts that are already done or unneeded, missing needs, and guesses
a builder would have to make. Load this file only when the check is selected.

## Selection

- `/feature` and Autopilot use `qualityGates.regular.specCheck`; Continuous
  uses `qualityGates.continuous.specCheck`.
- `always` runs the check for every new feature spec. `manual`, the default,
  runs it only when the user asks, for example `/feature 7 --check`. The
  `--check` argument is not part of the target.
- It runs once, after the critique gate wrote the spec and before the review
  stop. Never rerun it on the revised spec unless the user asks.

## Run the reviewer

Use a fresh isolated child with no builder conversation when the current adapter
supports one. Run it on the session's model or a cheaper one, never a larger
one. Give it only the prompt below with the paths filled in. It must not edit
files, run the app, install anything, or start servers.

```text
You are a software engineer reviewing a feature spec before it is approved for
building. Nothing in it has been built yet. You did not write it and cannot ask
its author anything.

Read <spec path>. Then read only the code, tests, configuration, and plan files
the spec names or directly depends on. Plans are in blueprint/project-plan.md
and blueprint/build-plan.md; earlier finished specs are in
blueprint/history/features/. Do not edit files, run the app, or install
anything.

Report only problems that would change what gets built:
- the spec assumes code, names, or behavior that does not match the repository
- parts of the spec that are already done or no longer needed
- things the feature needs that the spec leaves out, including how it interacts
  with existing features and where the plans say it will run
- places a builder would have to guess where a wrong guess would matter

For each, give what is wrong, the evidence as file and line, and what the spec
should say instead. Rank by importance. Skip style, wording, and anything a
sensible builder could decide alone. If nothing important is wrong, say
"nothing important left".
```

Without an isolated child, read the spec once as that reviewer yourself and
label the result `same-session`; it is weaker because it shares the drafting
context. If the child fails or times out, say so in the review note and
continue to the normal review stop. The check never blocks review.

## Triage

Confirm each finding against repository evidence before acting on it. Sort it
into one pile:

- **Dropped:** wrong, already covered by the spec, or something a build step
  will naturally surface and handle.
- **Fixed:** a real gap with one sensible answer that changes no product, data,
  security, or interoperability decision. Apply it to the spec.
- **Needs you:** the answer changes what gets built. Add it under
  `Open questions`.

Triage follows the same proportional-engineering and scope rules as the
critique gate. A finding never pulls in later features or adds machinery
without a current requirement.

## Record and report

Revise the spec once. Add one line to `Notes for the AI`:
`Spec check: <fresh subagent | same-session | failed>, <n> findings: <d>
dropped, <f> fixed, <q> need you.` Lead the review handoff with that line, a
short list of what was fixed, and the Needs-you questions, most important
first.

Autopilot and Continuous apply the fixes without pausing. A Needs-you item
stops them with the exact decision required, like any other unresolved product
decision.
