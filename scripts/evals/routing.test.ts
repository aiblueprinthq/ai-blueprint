import assert from "node:assert/strict";
import test from "node:test";
import { buildCorpus, evaluateCatalog, parseArguments, rankSkills, tokenize } from "./routing.js";

const skills = [
  {
    name: "build-widget",
    description: "Build and implement widgets. Use when creating widget behavior."
  },
  {
    name: "review-widget",
    description: "Review widget code for defects. Use when auditing widget quality."
  }
];

function casesFor(
  skill: string,
  positivePrompt: string,
  negativePrompt: string,
  owner: string
) {
  return {
    file: `${skill}.json`,
    data: {
      skill,
      positive: [1, 2, 3].map(() => ({ prompt: positivePrompt, top_k: 1 })),
      negative: [1, 2].map(() => ({ prompt: negativePrompt, owner }))
    }
  };
}

test("tokenizes common word forms consistently", () => {
  assert.deepEqual(tokenize("Auditing reviewed widgets"), ["audit", "review", "widget"]);
});

test("ranks the best matching skill first", () => {
  const ranking = rankSkills("audit this widget for code defects", buildCorpus(skills));

  assert.equal(ranking[0].name, "review-widget");
  assert.ok(ranking[0].score > ranking[1].score);
});

test("gives an explicit skill invocation priority over surrounding prose", () => {
  const ranking = rankSkills("Run /build-widget after reviewing the code", buildCorpus(skills));

  assert.equal(ranking[0].name, "build-widget");
});

test("accepts a complete catalog with correctly owned prompts", () => {
  const result = evaluateCatalog(
    skills,
    [
      casesFor("build-widget", "implement widget behavior", "audit widget defects", "review-widget"),
      casesFor("review-widget", "audit widget defects", "implement widget behavior", "build-widget")
    ],
    { minimumRankOne: 100 }
  );

  assert.deepEqual(result.failures, []);
  assert.equal(result.assertionCount, 10);
});

test("rejects missing coverage and routing mistakes", () => {
  const result = evaluateCatalog(
    skills,
    [
      casesFor(
        "build-widget",
        "audit widget defects",
        "implement widget behavior",
        "review-widget"
      )
    ],
    { minimumRankOne: 100 }
  );

  assert.ok(result.failures.some((failure) => failure.includes("review-widget: missing")));
  assert.ok(result.failures.some((failure) => failure.includes("positive prompt ranked")));
  assert.ok(result.failures.some((failure) => failure.includes("did not outrank")));
});

test("validates the rank-one command option", () => {
  assert.deepEqual(parseArguments(["--min-rank1", "80"]), { minimumRankOne: 80 });
  assert.throws(() => parseArguments(["--min-rank1", "101"]), /number from 0 to 100/);
  assert.throws(() => parseArguments(["--unknown"]), /Unknown argument/);
});
