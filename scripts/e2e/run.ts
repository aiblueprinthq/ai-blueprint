import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Runner, ensureAgentAvailable } from "./harness.js";
import type { Scenario } from "./harness.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.join(__dirname, "scenarios");

async function main() {
  if (process.env.E2E_ACCEPT_RISK !== "1") {
    console.error(
      "This harness drives a live agent with --dangerously-skip-permissions in a\n" +
        "scratch workspace on this machine, and it spends real tokens.\n" +
        "Run it as: E2E_ACCEPT_RISK=1 npm run test:e2e"
    );
    process.exit(1);
  }

  ensureAgentAvailable();

  const available = fs
    .readdirSync(scenariosDir)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.replace(/\.ts$/, ""))
    .sort();
  const requested = process.argv.slice(2);

  for (const name of requested) {
    if (!available.includes(name)) {
      throw new Error(`Unknown scenario: ${name}. Available: ${available.join(", ")}`);
    }
  }

  const selected = requested.length > 0 ? requested : available;
  let failures = 0;

  for (const name of selected) {
    const module: unknown = await import(
      pathToFileURL(path.join(scenariosDir, `${name}.ts`)).href
    );
    const scenario =
      typeof module === "object" &&
      module !== null &&
      "default" in module &&
      isScenario(module.default)
        ? module.default
        : null;

    if (!scenario) {
      throw new Error(`Scenario ${name} has no valid default export.`);
    }
    console.log(`\n=== Scenario: ${scenario.name} - ${scenario.description} ===`);
    const runner = new Runner(scenario.name);

    try {
      await scenario.run(runner);
    } catch (error: unknown) {
      runner.check(
        `scenario ran without harness errors (${error instanceof Error ? error.message : String(error)})`,
        false
      );
    }

    failures += runner.report();
  }

  if (failures > 0) {
    console.error(`\nE2E failed: ${failures} check(s) did not pass.`);
    process.exit(1);
  }

  console.log("\nE2E passed.");
}

function isScenario(value: unknown): value is Scenario {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { description?: unknown }).description === "string" &&
    typeof (value as { run?: unknown }).run === "function"
  );
}

main().catch((error: unknown) => {
  console.error(`E2E harness error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
