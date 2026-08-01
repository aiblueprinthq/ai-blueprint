const fs = require("node:fs/promises");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const codexSkillsRoot = path.join(repoRoot, ".agents", "skills");
const claudeSkillsRoot = path.join(repoRoot, ".claude", "skills");
const requiredPaths = [
  "AGENTS.md",
  "CLAUDE.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/question.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/release.yml",
  ".github/workflows/publish.yml",
  ".github/workflows/validate.yml",
  "assets/mark-dark.svg",
  "assets/mark-light.svg",
  "assets/social-preview.png",
  "assets/social-preview.svg",
  "blueprint/build-plan.md",
  "blueprint/project-plan.md",
  "blueprint/context/ai-interaction.md",
  "blueprint/context/coding-standards.md",
  "blueprint/context/current-feature.md",
  "blueprint/context/findings.md",
  "blueprint/context/project-overview.md",
  "blueprint/history/features/README.md",
  "blueprint/history/fixes/README.md",
  "blueprint/history/rollbacks/README.md",
  "packages/create-ai-blueprint/bin/create-ai-blueprint.js",
  "packages/create-ai-blueprint/LICENSE",
  "packages/create-ai-blueprint/lib/update.js",
  "packages/create-ai-blueprint/package.json"
];

async function main() {
  await validateRequiredPaths();

  const codexFiles = await listFiles(codexSkillsRoot);
  const claudeFiles = await listFiles(claudeSkillsRoot);
  assertEqualLists(codexFiles, claudeFiles, "adapter file inventory");

  for (const relativePath of codexFiles) {
    const codexFile = path.join(codexSkillsRoot, ...relativePath.split("/"));
    const claudeFile = path.join(claudeSkillsRoot, ...relativePath.split("/"));
    const [codexContent, claudeContent] = await Promise.all([
      fs.readFile(codexFile),
      fs.readFile(claudeFile)
    ]);

    if (!codexContent.equals(claudeContent)) {
      throw new Error(`Adapter files differ: ${relativePath}`);
    }
  }

  const skills = await getSkillNames(codexSkillsRoot);
  await validateSkillMetadata(skills);
  await validateCommandInventories(skills);
  await validateVerificationContract();
  await validateRepositoryPolish();
  const importCount = await validateClaudeImports();
  const referenceCount = await validateSkillReferences(codexFiles);
  await validatePackageMetadata();

  console.log(
    `Static contract passed: ${skills.length} skills, ${codexFiles.length} adapter files, ${importCount} Claude imports, ${referenceCount} skill references.`
  );
}

async function validateRequiredPaths() {
  for (const relativePath of requiredPaths) {
    await requirePath(path.join(repoRoot, ...relativePath.split("/")), relativePath);
  }
}

async function listFiles(root) {
  const files = [];

  async function visit(current, relative) {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolutePath = path.join(current, entry.name);
      const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
      const stats = await fs.lstat(absolutePath);

      if (stats.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed in adapter skills: ${relativePath}`);
      }

      if (stats.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (stats.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error(`Unsupported adapter entry: ${relativePath}`);
      }
    }
  }

  await visit(root, "");
  return files.sort();
}

async function getSkillNames(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      throw new Error(`Unexpected entry in skills directory: ${entry.name}`);
    }

    await requirePath(path.join(root, entry.name, "SKILL.md"), `${entry.name}/SKILL.md`);
    skills.push(entry.name);
  }

  return skills.sort();
}

async function validateSkillMetadata(skills) {
  for (const skill of skills) {
    const skillFile = path.join(codexSkillsRoot, skill, "SKILL.md");
    const content = await fs.readFile(skillFile, "utf8");
    const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

    if (!frontmatter) {
      throw new Error(`Missing frontmatter: .agents/skills/${skill}/SKILL.md`);
    }

    const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();

    if (name !== skill) {
      throw new Error(`Skill name does not match its directory: ${skill}`);
    }

    if (!description) {
      throw new Error(`Skill description is missing: ${skill}`);
    }
  }
}

async function validateCommandInventories(skills) {
  const [agents, readme] = await Promise.all([
    fs.readFile(path.join(repoRoot, "AGENTS.md"), "utf8"),
    fs.readFile(path.join(repoRoot, "README.md"), "utf8")
  ]);
  const coreBlock = agents.match(/Core skills:\r?\n([\s\S]*?)\r?\nIn Codex/);

  if (!coreBlock) {
    throw new Error("Could not find the Core skills inventory in AGENTS.md");
  }

  const agentSkills = [...coreBlock[1].matchAll(/^- `([a-z0-9-]+)`/gm)].map(
    (match) => match[1]
  );
  const optionalSkills = [
    ...agents.matchAll(/Optional explicit-only skill: `([a-z0-9-]+)`/g)
  ].map((match) => match[1]);
  const readmeSkills = [
    ...readme.matchAll(/^\| \*\*\/([a-z0-9-]+)\*\* \|/gm)
  ].map((match) => match[1]);

  assertEqualLists(skills, [...agentSkills, ...optionalSkills].sort(), "AGENTS.md commands");
  assertEqualLists(skills, readmeSkills.sort(), "README command table");
}

async function validateVerificationContract() {
  const requirements = new Map([
    [
      ".agents/skills/onboard/SKILL.md",
      ["Run /ci or $ci when you want automatic GitHub checks."]
    ],
    [
      ".agents/skills/adopt/SKILL.md",
      ["Run /ci or $ci when you want automatic GitHub checks."]
    ],
    [
      ".agents/skills/ci/SKILL.md",
      [
        ".github/workflows/verify.yml",
        "permissions: contents: read",
        "Never push or change a remote ruleset"
      ]
    ],
    [
      ".agents/skills/tests/SKILL.md",
      ["add the real test command", "never creates a GitHub workflow on its own"]
    ],
    [
      ".agents/skills/implement/SKILL.md",
      ["declares a `Verify` command, run that exact", "fallback build and tests"]
    ],
    [
      ".agents/skills/complete/SKILL.md",
      ["exact `Verify` command from `AGENTS.md`", "fallback build and tests"]
    ],
    [
      ".agents/skills/doctor/SKILL.md",
      ["missing `Verify` command or GitHub workflow is informational"]
    ],
    [
      ".agents/skills/autopilot/SKILL.md",
      ["exact `Verify` command from `AGENTS.md`"]
    ],
    ["AGENTS.md", ["## Automatic verification", "`contents: read`"]],
    ["README.md", ["## Automatic GitHub checks", "**Verify is the recipe.**"]],
    [
      "blueprint/context/coding-standards.md",
      ["treat it as the umbrella automated"]
    ],
    [
      "blueprint/context/ai-interaction.md",
      ["run that exact command as the final automated gate"]
    ],
    [
      "packages/create-ai-blueprint/README.md",
      ["optional `/ci` or `$ci` skill"]
    ]
  ]);

  for (const [relativePath, phrases] of requirements) {
    const content = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
    const normalizedContent = content.replace(/\s+/g, " ");

    for (const phrase of phrases) {
      const normalizedPhrase = phrase.replace(/\s+/g, " ");

      if (!normalizedContent.includes(normalizedPhrase)) {
        throw new Error(`Verification contract missing from ${relativePath}: ${phrase}`);
      }
    }
  }
}

async function validateClaudeImports() {
  const content = await fs.readFile(path.join(repoRoot, "CLAUDE.md"), "utf8");
  const imports = [...content.matchAll(/^@(.+)$/gm)].map((match) => match[1].trim());

  if (imports.length === 0) {
    throw new Error("CLAUDE.md does not import any project files");
  }

  for (const relativePath of imports) {
    assertSafeRelativePath(relativePath);
    await requirePath(
      path.join(repoRoot, ...relativePath.split("/")),
      `CLAUDE.md import ${relativePath}`
    );
  }

  return imports.length;
}

async function validateSkillReferences(adapterFiles) {
  let count = 0;

  for (const relativePath of adapterFiles.filter((file) => file.endsWith("SKILL.md"))) {
    const skillFile = path.join(codexSkillsRoot, ...relativePath.split("/"));
    const content = await fs.readFile(skillFile, "utf8");
    const references = [
      ...content.matchAll(/`(reference\/[A-Za-z0-9._/-]+)`/g)
    ].map((match) => match[1]);

    for (const reference of new Set(references)) {
      assertSafeRelativePath(reference);
      await requirePath(
        path.join(path.dirname(skillFile), ...reference.split("/")),
        `${relativePath} reference ${reference}`
      );
      count += 1;
    }
  }

  return count;
}

async function validatePackageMetadata() {
  const packageRoot = path.join(repoRoot, "packages", "create-ai-blueprint");
  const metadata = JSON.parse(
    await fs.readFile(path.join(packageRoot, "package.json"), "utf8")
  );
  const requiredFiles = [
    "bin/",
    "lib/",
    "template/",
    "README.md",
    "LICENSE",
    "package.json"
  ];
  const requiredScripts = ["test", "prepare-template", "prepack", "postpack"];

  if (metadata.bin?.["create-ai-blueprint"] !== "bin/create-ai-blueprint.js") {
    throw new Error("Package bin entry does not point to the installer CLI");
  }

  for (const requiredFile of requiredFiles) {
    if (!metadata.files?.includes(requiredFile)) {
      throw new Error(`Required package entry is missing: ${requiredFile}`);
    }
  }

  for (const script of requiredScripts) {
    if (!metadata.scripts?.[script]) {
      throw new Error(`Package script is missing: ${script}`);
    }
  }

  if (metadata.license !== "MIT") {
    throw new Error("Package license must be MIT");
  }

  if (metadata.homepage !== "https://ai-blueprint.dev") {
    throw new Error("Package homepage must point to the official site");
  }

  if (metadata.author !== "Brad Traversy") {
    throw new Error("Package author metadata is missing");
  }

  for (const keyword of [
    "ai-coding",
    "claude-code",
    "context-engineering",
    "spec-driven-development"
  ]) {
    if (!metadata.keywords?.includes(keyword)) {
      throw new Error(`Package keyword is missing: ${keyword}`);
    }
  }

  const binStats = await fs.stat(path.join(packageRoot, "bin", "create-ai-blueprint.js"));

  if (process.platform !== "win32" && (binStats.mode & 0o111) === 0) {
    throw new Error("Installer CLI is not executable");
  }
}

async function validateRepositoryPolish() {
  const [rootLicense, packageLicense, packageMetadata, changelog, publishWorkflow] =
    await Promise.all([
      fs.readFile(path.join(repoRoot, "LICENSE")),
      fs.readFile(path.join(repoRoot, "packages", "create-ai-blueprint", "LICENSE")),
      fs.readFile(
        path.join(repoRoot, "packages", "create-ai-blueprint", "package.json"),
        "utf8"
      ),
      fs.readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8"),
      fs.readFile(path.join(repoRoot, ".github", "workflows", "publish.yml"), "utf8")
    ]);

  if (!rootLicense.equals(packageLicense)) {
    throw new Error("Root and npm package license files differ");
  }

  const version = JSON.parse(packageMetadata).version;

  if (!changelog.includes(`## [${version}]`)) {
    throw new Error(`CHANGELOG.md does not include package version ${version}`);
  }

  if (!publishWorkflow.includes("gh release create")) {
    throw new Error("Publish workflow does not create a GitHub release");
  }

  const preview = await fs.readFile(path.join(repoRoot, "assets", "social-preview.png"));

  if (preview.length >= 1_000_000) {
    throw new Error("Social preview must remain under 1 MB");
  }

  if (
    preview.toString("ascii", 1, 4) !== "PNG" ||
    preview.readUInt32BE(16) !== 1280 ||
    preview.readUInt32BE(20) !== 640
  ) {
    throw new Error("Social preview must be a 1280x640 PNG");
  }
}

async function requirePath(absolutePath, label) {
  try {
    await fs.access(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Required path is missing: ${label}`);
    }

    throw error;
  }
}

function assertEqualLists(expected, actual, label) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `${label} mismatch. Expected [${expected.join(", ")}], received [${actual.join(", ")}].`
    );
  }
}

function assertSafeRelativePath(relativePath) {
  const normalized = path.posix.normalize(relativePath.replaceAll("\\", "/"));

  if (
    normalized !== relativePath ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Unsafe repository reference: ${relativePath}`);
  }
}

main().catch((error) => {
  console.error(`Static contract failed: ${error.message}`);
  process.exit(1);
});
