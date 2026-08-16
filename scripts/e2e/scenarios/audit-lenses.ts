import type { Runner } from "../harness.js";

async function run(t: Runner) {
  t.phase("setup");
  t.installBlueprint();

  const secureAccountSource = `function updateEmail(store, session, input) {
  return store.users.update(session.userId, { email: input.email });
}

export default { updateEmail };
`;
  const vulnerableAccountSource = `function updateEmail(store, session, input) {
  return store.users.update(input.userId, { email: input.email });
}

export default { updateEmail };
`;
  const originalFormatSource = `exports.normalizeEmail = (value) => value.trim().toLowerCase();
`;
  const duplicatedFormatSource = `exports.normalizePrimaryEmail = (value) => value.trim().toLowerCase();
exports.normalizeBackupEmail = (value) => value.trim().toLowerCase();
`;

  t.write("src/account.js", secureAccountSource);
  t.write("src/format.js", originalFormatSource);
  t.gitInit();
  t.git("add", "-A");
  t.git("commit", "-m", "chore: create audit fixture");
  const headBefore = t.git("rev-parse", "HEAD");

  t.write("src/account.js", vulnerableAccountSource);
  t.write("src/format.js", duplicatedFormatSource);

  t.phase("security lens stays focused and records its lens");
  const result = t.agent(
    "Run /audit security changed. Use only the security lens, record confirmed findings, and do not review unrelated quality concerns."
  );

  t.check("agent invocation succeeded", result.status === 0);
  t.check("account source stayed unchanged", t.read("src/account.js") === vulnerableAccountSource);
  t.check("format source stayed unchanged", t.read("src/format.js") === duplicatedFormatSource);
  t.check("no commit was created", t.git("rev-parse", "HEAD") === headBefore);
  t.check("the repository stayed on main", t.git("branch", "--show-current") === "main");

  const ledger = t.read("blueprint/context/findings.md") || "";
  t.check("the ledger records the security lens", /lens:\s*security/i.test(ledger));
  t.check("the ownership issue is a confirmed finding", /### F-\d{2} \[P[01]\] open/i.test(ledger));
  t.check("the finding points to account.js", ledger.includes("src/account.js"));
  t.check(
    "the quality-only format file was not recorded as a finding",
    !/\*\*File:\*\*\s*src\/format\.js/i.test(ledger)
  );
  t.check(
    "the report names the security lens",
    /security lens|lens[:|\s`]*security/i.test(result.resultText)
  );
  t.check(
    "the report names the changed scope",
    /scope[:|\s`]*changed|changed scope/i.test(result.resultText)
  );
  const changedPaths = t.git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.trimStart().replace(/^\S+\s+/, ""))
    .sort();
  t.check(
    "audit changed only the findings ledger",
    JSON.stringify(changedPaths) === JSON.stringify([
      "blueprint/context/findings.md",
      "src/account.js",
      "src/format.js"
    ])
  );
}

export default {
  name: "audit-lenses",
  description: "A focused audit reviews its lens without editing application code",
  run
};
