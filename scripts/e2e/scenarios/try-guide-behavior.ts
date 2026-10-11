import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Runner } from "../harness.js";

interface EvaluationCase {
  id: string;
  policy: "manual" | "always" | "when-user-facing" | "when-testable";
  feature: string;
  userFacing: boolean;
}

interface EvaluationResult {
  id: string;
  selected: boolean;
  testable: boolean;
  handoff: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const casesPath = path.resolve(__dirname, "..", "..", "..", "evals", "try-guide.json");

function parseResults(resultText: string): EvaluationResult[] {
  const firstBrace = resultText.indexOf("{");
  const lastBrace = resultText.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(resultText.slice(firstBrace, lastBrace + 1));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("cases" in parsed) ||
      !Array.isArray(parsed.cases)
    ) {
      return [];
    }
    return parsed.cases as EvaluationResult[];
  } catch {
    return [];
  }
}

function byId(results: EvaluationResult[], id: string): EvaluationResult | undefined {
  return results.find((result) => result.id === id);
}

function hasProof(result: EvaluationResult | undefined): boolean {
  return Boolean(
    result?.handoff.includes("## Try it now") &&
    result.handoff.includes("Run or do:") &&
    result.handoff.includes("Expected:") &&
    result.handoff.includes("This proves:")
  );
}

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8")) as EvaluationCase[];
  t.write("try-guide-evaluation.json", `${JSON.stringify(cases, null, 2)}\n`);

  t.phase("the shipped Check and Implement skills classify and hand off try guides");
  const result = t.agent(
    "Read the installed Check skill, its guide reference, the Implement skill, " +
      "blueprint/config.json, and try-guide-evaluation.json. For each case, decide whether its " +
      "policy automatically selects /check guide and whether the feature has a safe, meaningful " +
      "direct observation. If selected and testable, write the exact final handoff section that " +
      "Implement would give the user. If it cannot be directly tried, do not invent a proof. " +
      "Do not edit files, run commands, or start a server. Return only one JSON object with a " +
      "cases array. Each item must have id, selected, testable, and handoff string fields."
  );
  const results = parseResults(result.resultText);

  t.check("agent invocation succeeded", result.status === 0);
  t.check("all evaluation cases were returned", results.length === cases.length);

  t.check("manual remains opt-in", byId(results, "manual-cli")?.selected === false);
  t.check("always still selects an internal change", byId(results, "always-internal")?.selected === true);
  t.check("when-user-facing selects UI", byId(results, "user-facing-ui")?.selected === true);
  t.check("when-user-facing does not select a library API", byId(results, "user-facing-library")?.selected === false);
  t.check("when-testable selects CLI", byId(results, "testable-cli")?.selected === true);
  t.check("when-testable selects a library API", byId(results, "testable-library")?.selected === true);
  t.check("when-testable selects UI", byId(results, "testable-ui")?.selected === true);
  t.check("when-testable skips documentation-only work", byId(results, "testable-docs")?.selected === false);
  t.check("when-testable skips an invisible refactor", byId(results, "testable-internal")?.selected === false);

  const cli = byId(results, "testable-cli");
  t.check("CLI handoff has the complete proof contract", hasProof(cli));
  t.check("CLI handoff includes the runnable command", cli?.handoff.includes("node src/greeting.js Ada"));
  t.check("CLI handoff includes exact expected output", cli?.handoff.includes("Hello, Ada!"));

  const library = byId(results, "testable-library");
  t.check("library handoff has the complete proof contract", hasProof(library));
  t.check("library handoff includes an executable example", /node .*greet\(['\"]Ada['\"]\)/s.test(library?.handoff || ""));
  t.check("library handoff includes exact expected output", library?.handoff.includes("Hello, Ada!"));

  const ui = byId(results, "testable-ui");
  t.check("UI handoff has the complete proof contract", hasProof(ui));
  t.check("UI handoff tells the user to start the server", /you|yourself/i.test(ui?.handoff || "") && Boolean(ui?.handoff.includes("npm run dev")));
  t.check("UI handoff includes the route and visible result", Boolean(ui?.handoff.includes("/profile") && ui.handoff.includes("Profile saved")));

  for (const id of ["always-internal", "testable-docs", "testable-internal"]) {
    const evaluated = byId(results, id);
    t.check(`${id} is classified as non-testable`, evaluated?.testable === false);
    t.check(`${id} has no fabricated proof`, !evaluated?.handoff.includes("## Try it now"));
  }
}

export default {
  name: "try-guide-behavior",
  description: "Shipped skills select, classify, and hand off Automatic Try It Now proofs",
  run
};
