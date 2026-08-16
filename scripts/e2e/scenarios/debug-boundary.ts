const test = `const assert = require("node:assert/strict");
const { test } = require("node:test");
const { total } = require("../src/cart-total");

test("totals prices from request data", () => {
  assert.equal(total([{ price: "10" }, { price: "5" }]), 15);
});
`;

import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();
  const agents = t.read("AGENTS.md") ?? "";
  t.write(
    "AGENTS.md",
    agents.slice(0, agents.indexOf("## Commands")) +
      "## Commands\n\n- Test: `npm test`\n\nNo build command is configured.\n"
  );
  t.write(
    "package.json",
    JSON.stringify(
      {
        name: "debug-fixture",
        private: true,
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    ) + "\n"
  );
  t.write(
    "src/cart-total.js",
    "exports.total = (items) => items.reduce((sum, item) => sum + item.price, 0);\n"
  );
  t.write("test/cart-total.test.js", test);
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create debug fixture");
  const headBefore = t.git("rev-parse", "HEAD");
  const sourceBefore = t.read("src/cart-total.js");
  const testBefore = t.read("test/cart-total.test.js");
  const currentFeatureBefore = t.read("blueprint/context/current-feature.md");

  t.phase("debug reproduces and diagnoses without editing");
  const result = t.agent(
    "Run /debug. npm test fails in cart-total.test.js. Diagnose the root cause and stop without fixing it."
  );

  t.check("agent invocation succeeded", result.status === 0);
  t.check("source stayed unchanged", t.read("src/cart-total.js") === sourceBefore);
  t.check("the failing test stayed unchanged", t.read("test/cart-total.test.js") === testBefore);
  t.check(
    "Blueprint state stayed unchanged",
    t.read("blueprint/context/current-feature.md") === currentFeatureBefore
  );
  t.check("the working tree stayed clean", t.git("status", "--porcelain") === "");
  t.check("no commit was created", t.git("rev-parse", "HEAD") === headBefore);
  t.check("the repository stayed on main", t.git("branch", "--show-current") === "main");
  t.check("the report includes the failing test evidence", /npm test|cart-total\.test\.js/i.test(result.resultText));
  t.check("the report identifies string concatenation", /string|concat|coerc/i.test(result.resultText));
  t.check("the report hands confirmed repair to fix", result.resultText.includes("/fix"));
}

export default {
  name: "debug-boundary",
  description: "Debug reproduces and explains a failure without changing project state",
  run
};
