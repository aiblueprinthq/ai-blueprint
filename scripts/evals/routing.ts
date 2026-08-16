import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const skillsRoot = path.join(repoRoot, ".agents", "skills");
const casesRoot = path.join(repoRoot, "evals", "routing");
const minimumPositiveCases = 3;
const minimumNegativeCases = 2;
type TermCounts = Map<string, number>;

interface Skill {
  name: string;
  description: string;
}

interface Corpus {
  documents: Map<string, TermCounts>;
  inverseDocumentFrequency: (term: string) => number;
}

interface RankedSkill {
  name: string;
  score: number;
}

interface CaseFile {
  file: string;
  data?: unknown;
  parseError?: string;
}

interface PromptCase {
  prompt?: unknown;
  top_k?: unknown;
  owner?: unknown;
}

interface EvaluationResult {
  assertionCount: number;
  failures: string[];
  positiveCount: number;
  rankOneCount: number;
  rankOneRate: number;
  warnings: string[];
}

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "any",
  "are",
  "before",
  "can",
  "does",
  "for",
  "from",
  "have",
  "help",
  "into",
  "its",
  "just",
  "make",
  "need",
  "our",
  "that",
  "the",
  "their",
  "them",
  "then",
  "this",
  "through",
  "use",
  "user",
  "want",
  "when",
  "with",
  "you",
  "your"
]);

function stem(token: string): string {
  for (const suffix of ["ingly", "ation", "ments", "ment", "ally", "ing", "ied", "ed", "es"]) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }

  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    token = token.slice(0, -1);
  }

  if (token.length > 4 && token.endsWith("e")) {
    token = token.slice(0, -1);
  }

  const lastCharacter = token.at(-1);

  if (
    token.length > 4 &&
    token.at(-1) === token.at(-2) &&
    lastCharacter !== undefined &&
    !"aeiou".includes(lastCharacter)
  ) {
    token = token.slice(0, -1);
  }

  return token;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token))
    .map(stem);
}

function countTerms(tokens: readonly string[]): TermCounts {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return counts;
}

function buildCorpus(skills: readonly Skill[]): Corpus {
  const documents = new Map<string, TermCounts>();

  for (const skill of skills) {
    const nameTokens = tokenize(skill.name.replaceAll("-", " "));
    documents.set(
      skill.name,
      countTerms([...nameTokens, ...nameTokens, ...tokenize(skill.description)])
    );
  }

  const documentFrequency = new Map<string, number>();

  for (const terms of documents.values()) {
    for (const term of terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  return {
    documents,
    inverseDocumentFrequency(term) {
      return Math.log(1 + documents.size / (1 + (documentFrequency.get(term) || 0)));
    }
  };
}

function vectorize(
  terms: ReadonlyMap<string, number>,
  inverseDocumentFrequency: (term: string) => number
): TermCounts {
  const vector = new Map<string, number>();

  for (const [term, frequency] of terms) {
    vector.set(term, frequency * inverseDocumentFrequency(term));
  }

  return vector;
}

function cosineSimilarity(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>
): number {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const [term, weight] of left) {
    leftMagnitude += weight * weight;
    dotProduct += weight * (right.get(term) || 0);
  }

  for (const weight of right.values()) {
    rightMagnitude += weight * weight;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function rankSkills(prompt: string, corpus: Corpus): RankedSkill[] {
  const invokedSkill = prompt.match(/(?:^|\s)[/$]([a-z0-9-]+)/i)?.[1]?.toLowerCase();
  const promptVector = vectorize(
    countTerms(tokenize(prompt)),
    corpus.inverseDocumentFrequency
  );

  return [...corpus.documents.entries()]
    .map(([name, terms]) => ({
      name,
      score:
        cosineSimilarity(
          promptVector,
          vectorize(terms, corpus.inverseDocumentFrequency)
        ) + (name === invokedSkill ? 1 : 0)
    }))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

function parseFrontmatterScalar(value: string): string {
  const trimmed = value.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return JSON.parse(trimmed);
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
}

function loadSkills(root = skillsRoot): Skill[] {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = path.join(root, entry.name, "SKILL.md");
      const content = fs.readFileSync(skillPath, "utf8");
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

      if (!frontmatter) {
        throw new Error(`Missing frontmatter: ${path.relative(repoRoot, skillPath)}`);
      }

      const nameMatch = frontmatter[1].match(/^name:\s*(.+)$/m);
      const descriptionMatch = frontmatter[1].match(/^description:\s*(.+)$/m);

      if (!nameMatch || !descriptionMatch) {
        throw new Error(`Missing routing metadata: ${path.relative(repoRoot, skillPath)}`);
      }

      return {
        name: parseFrontmatterScalar(nameMatch[1]),
        description: parseFrontmatterScalar(descriptionMatch[1])
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function loadCases(root = casesRoot): CaseFile[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const filePath = path.join(root, file);

      try {
        return { file, data: JSON.parse(fs.readFileSync(filePath, "utf8")) };
      } catch (error: unknown) {
        return { file, parseError: error instanceof Error ? error.message : String(error) };
      }
    });
}

function validatePrompt(prompt: unknown): prompt is string {
  return typeof prompt === "string" && prompt.trim().length > 0;
}

function evaluateCatalog(
  skills: readonly Skill[],
  caseFiles: readonly CaseFile[],
  { minimumRankOne = 75 }: { minimumRankOne?: number } = {}
): EvaluationResult {
  const failures: string[] = [];
  const warnings: string[] = [];
  const skillNames = new Set(skills.map((skill) => skill.name));
  const corpus = buildCorpus(skills);
  let positiveCount = 0;
  let rankOneCount = 0;
  let assertionCount = 0;

  for (const skill of skills) {
    if (!caseFiles.some((entry) => entry.file === `${skill.name}.json`)) {
      failures.push(`${skill.name}: missing evals/routing/${skill.name}.json`);
    }
  }

  for (const entry of caseFiles) {
    if (entry.parseError) {
      failures.push(`${entry.file}: invalid JSON (${entry.parseError})`);
      continue;
    }

    const expectedSkill = entry.file.replace(/\.json$/, "");
    const data = isRecord(entry.data) ? entry.data : {};

    if (!skillNames.has(expectedSkill)) {
      failures.push(`${entry.file}: no matching skill directory`);
      continue;
    }

    if (data.skill !== expectedSkill) {
      failures.push(`${entry.file}: skill must equal ${expectedSkill}`);
    }

    const positiveCases = promptCases(data.positive);
    const negativeCases = promptCases(data.negative);

    if (!Array.isArray(data.positive) || positiveCases.length < minimumPositiveCases) {
      failures.push(
        `${entry.file}: needs at least ${minimumPositiveCases} positive prompts`
      );
    }

    if (!Array.isArray(data.negative) || negativeCases.length < minimumNegativeCases) {
      failures.push(
        `${entry.file}: needs at least ${minimumNegativeCases} negative prompts`
      );
    }

    for (const testCase of positiveCases) {
      assertionCount += 1;
      positiveCount += 1;

      if (!validatePrompt(testCase.prompt)) {
        failures.push(`${entry.file}: positive prompt must be a non-empty string`);
        continue;
      }

      const topK = typeof testCase.top_k === "number" ? testCase.top_k : 3;

      if (!Number.isInteger(topK) || topK < 1 || topK > skills.length) {
        failures.push(`${entry.file}: top_k must be an integer from 1 to ${skills.length}`);
        continue;
      }

      const ranking = rankSkills(testCase.prompt, corpus);
      const index = ranking.findIndex((result) => result.name === expectedSkill);
      const match = ranking[index];

      if (index === 0 && match.score > 0) {
        rankOneCount += 1;
      }

      if (index >= topK || match.score === 0) {
        const leaders = ranking
          .filter((result) => result.score > 0)
          .slice(0, 3)
          .map((result) => `${result.name} (${result.score.toFixed(2)})`)
          .join(", ");
        failures.push(
          `${expectedSkill}: positive prompt ranked #${index + 1}, expected top ${topK}: ` +
            `"${testCase.prompt}". Leaders: ${leaders || "none"}`
        );
      }
    }

    for (const testCase of negativeCases) {
      assertionCount += 1;

      if (!validatePrompt(testCase.prompt)) {
        failures.push(`${entry.file}: negative prompt must be a non-empty string`);
        continue;
      }

      if (typeof testCase.owner !== "string" || !skillNames.has(testCase.owner)) {
        failures.push(`${entry.file}: negative prompt needs a valid owner skill`);
        continue;
      }

      if (testCase.owner === expectedSkill) {
        failures.push(`${entry.file}: negative prompt owner cannot be ${expectedSkill}`);
        continue;
      }

      const ranking = rankSkills(testCase.prompt, corpus);
      const skillIndex = ranking.findIndex((result) => result.name === expectedSkill);
      const ownerIndex = ranking.findIndex((result) => result.name === testCase.owner);
      const skillMatch = ranking[skillIndex];
      const ownerMatch = ranking[ownerIndex];

      if (ownerMatch.score === 0 || ownerIndex >= skillIndex) {
        failures.push(
          `${expectedSkill}: owner ${testCase.owner} did not outrank it for ` +
            `"${testCase.prompt}" (owner #${ownerIndex + 1}, skill #${skillIndex + 1})`
        );
      }

      if (skillIndex === 0 && skillMatch.score > 0) {
        failures.push(
          `${expectedSkill}: ranked first for negative prompt owned by ${testCase.owner}: ` +
            `"${testCase.prompt}"`
        );
      }
    }
  }

  const descriptionVectors = [...corpus.documents.entries()].map(([name, terms]) => ({
    name,
    vector: vectorize(terms, corpus.inverseDocumentFrequency)
  }));

  for (let leftIndex = 0; leftIndex < descriptionVectors.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < descriptionVectors.length;
      rightIndex += 1
    ) {
      const left = descriptionVectors[leftIndex];
      const right = descriptionVectors[rightIndex];
      const similarity = cosineSimilarity(left.vector, right.vector);

      if (similarity >= 0.8) {
        failures.push(
          `${left.name} and ${right.name}: descriptions overlap by ${(similarity * 100).toFixed(0)}%`
        );
      } else if (similarity >= 0.6) {
        warnings.push(
          `${left.name} and ${right.name}: descriptions overlap by ${(similarity * 100).toFixed(0)}%`
        );
      }
    }
  }

  const rankOneRate = positiveCount === 0 ? 0 : (rankOneCount / positiveCount) * 100;

  if (rankOneRate < minimumRankOne) {
    failures.push(
      `Rank-one rate ${rankOneRate.toFixed(0)}% is below the required ${minimumRankOne}%`
    );
  }

  return {
    assertionCount,
    failures,
    positiveCount,
    rankOneCount,
    rankOneRate,
    warnings
  };
}

function parseArguments(args: readonly string[]): { minimumRankOne: number } {
  let minimumRankOne = 75;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--min-rank1") {
      throw new Error(`Unknown argument: ${args[index]}`);
    }

    const value = Number(args[index + 1]);

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error("--min-rank1 must be a number from 0 to 100");
    }

    minimumRankOne = value;
    index += 1;
  }

  return { minimumRankOne };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const skills = loadSkills();
  const caseFiles = loadCases();
  const result = evaluateCatalog(skills, caseFiles, options);

  console.log(
    `Skill routing: ${skills.length} skills, ${caseFiles.length} case files, ` +
      `${result.assertionCount} assertions.`
  );

  for (const warning of result.warnings) {
    console.log(`[warn] ${warning}`);
  }

  for (const failure of result.failures) {
    console.error(`[fail] ${failure}`);
  }

  console.log(
    `Rank-one routing: ${result.rankOneCount}/${result.positiveCount} ` +
      `(${result.rankOneRate.toFixed(0)}%).`
  );

  if (result.failures.length > 0) {
    process.exit(1);
  }

  console.log("Skill routing evaluations passed.");
}

if (import.meta.main) {
  try {
    main();
  } catch (error: unknown) {
    console.error(
      `Skill routing evaluations failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }

}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function promptCases(value: unknown): PromptCase[] {
  return Array.isArray(value)
    ? value.filter((caseValue): caseValue is PromptCase => isRecord(caseValue))
    : [];
}

export {
  buildCorpus,
  evaluateCatalog,
  parseArguments,
  rankSkills,
  tokenize
};
