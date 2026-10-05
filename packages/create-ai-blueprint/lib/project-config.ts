import fs from "node:fs/promises";
import path from "node:path";

// Stable repo-relative identifier for warnings and status output. path.join
// normalizes the separator for filesystem reads, so this must not be built with
// path.join or Windows would surface "blueprint\config.json" to users.
const PROJECT_CONFIG_PATH = "blueprint/config.json";
const PROJECT_CONFIG_SCHEMA_VERSION = 1 as const;

type StepReviewPolicy = "every" | "feature";
type CheckpointCommitPolicy = "disabled" | "enabled";
type LandingPolicy = "local-merge" | "pull-request";
type LogicTestPolicy = "required" | "when-configured";
type UiEvidencePolicy = "required" | "when-available";
type AuditGatePolicy = "always" | "manual" | "when-sensitive";
type IndependentReviewGatePolicy = "always" | "manual" | "when-sensitive";
type IndependentReviewExecution = "automatic" | "manual";
type CheckGatePolicy = "always" | "manual" | "when-behavioral";
type TryGuideGatePolicy = "always" | "manual" | "when-user-facing";
type ProjectConfigState = "defaults" | "invalid" | "project";

interface QualityGatePolicy {
  audit: AuditGatePolicy;
  independentReview: IndependentReviewGatePolicy;
  check: CheckGatePolicy;
  tryGuide: TryGuideGatePolicy;
}

interface ProjectConfig {
  schemaVersion: typeof PROJECT_CONFIG_SCHEMA_VERSION;
  workflow: {
    stepReview: StepReviewPolicy;
    checkpointCommits: CheckpointCommitPolicy;
  };
  git: {
    landing: LandingPolicy;
    featureBranchPrefix: string;
    fixBranchPrefix: string;
    rollbackBranchPrefix: string;
  };
  verification: {
    logicTests: LogicTestPolicy;
    uiEvidence: UiEvidencePolicy;
  };
  review: {
    independentExecution: IndependentReviewExecution;
  };
  qualityGates: {
    regular: QualityGatePolicy;
    continuous: QualityGatePolicy;
  };
  continuous: {
    maxFeatures: number | null;
    maxRepairAttempts: number;
    finalIntegrationAudit: boolean;
  };
}

interface ProjectConfigWarning {
  code: "invalid_config";
  message: string;
}

interface ProjectConfigResult {
  path: typeof PROJECT_CONFIG_PATH;
  state: ProjectConfigState;
  values: ProjectConfig;
  warnings: ProjectConfigWarning[];
}

function createDefaultProjectConfig(): ProjectConfig {
  return {
    schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
    workflow: {
      stepReview: "feature",
      checkpointCommits: "disabled"
    },
    git: {
      landing: "local-merge",
      featureBranchPrefix: "feature/",
      fixBranchPrefix: "fix/",
      rollbackBranchPrefix: "rollback/"
    },
    verification: {
      logicTests: "when-configured",
      uiEvidence: "when-available"
    },
    review: {
      independentExecution: "automatic"
    },
    qualityGates: {
      regular: {
        audit: "manual",
        independentReview: "when-sensitive",
        check: "manual",
        tryGuide: "manual"
      },
      continuous: {
        audit: "manual",
        independentReview: "when-sensitive",
        check: "manual",
        tryGuide: "manual"
      }
    },
    continuous: {
      maxFeatures: null,
      maxRepairAttempts: 2,
      finalIntegrationAudit: false
    }
  };
}

async function readProjectConfig(projectRoot: string): Promise<ProjectConfigResult> {
  const configPath = path.join(projectRoot, PROJECT_CONFIG_PATH);
  const defaults = createDefaultProjectConfig();

  try {
    const stats = await fs.lstat(configPath);

    if (stats.isSymbolicLink()) {
      return invalidResult("Blueprint config is a symbolic link and was not read.");
    }

    if (!stats.isFile()) {
      return invalidResult("Blueprint config path is not a regular file.");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return invalidResult(`Invalid Blueprint config JSON: ${PROJECT_CONFIG_PATH}`);
      }

      throw error;
    }

    try {
      return {
        path: PROJECT_CONFIG_PATH,
        state: "project",
        values: parseProjectConfig(parsed),
        warnings: []
      };
    } catch (error: unknown) {
      return invalidResult(
        `Unsupported or invalid Blueprint config: ${PROJECT_CONFIG_PATH}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      return {
        path: PROJECT_CONFIG_PATH,
        state: "defaults",
        values: defaults,
        warnings: []
      };
    }

    return invalidResult(
      `Unable to read Blueprint config: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  function invalidResult(message: string): ProjectConfigResult {
    return {
      path: PROJECT_CONFIG_PATH,
      state: "invalid",
      values: defaults,
      warnings: [{ code: "invalid_config", message }]
    };
  }
}

function parseProjectConfig(value: unknown): ProjectConfig {
  const root = requireRecord(value, "config");
  assertKnownKeys(
    root,
    [
      "schemaVersion",
      "workflow",
      "git",
      "verification",
      "review",
      "qualityGates",
      "continuous"
    ],
    "config"
  );

  if (root.schemaVersion !== PROJECT_CONFIG_SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${PROJECT_CONFIG_SCHEMA_VERSION}.`);
  }

  const defaults = createDefaultProjectConfig();
  const workflow = optionalRecord(root.workflow, "workflow");
  const git = optionalRecord(root.git, "git");
  const verification = optionalRecord(root.verification, "verification");
  const review = optionalRecord(root.review, "review");
  const qualityGates = optionalRecord(root.qualityGates, "qualityGates");
  const regularGates = optionalRecord(
    qualityGates.regular,
    "qualityGates.regular"
  );
  const continuousGates = optionalRecord(
    qualityGates.continuous,
    "qualityGates.continuous"
  );
  const continuous = optionalRecord(root.continuous, "continuous");

  assertKnownKeys(workflow, ["stepReview", "checkpointCommits"], "workflow");
  assertKnownKeys(
    git,
    [
      "landing",
      "featureBranchPrefix",
      "fixBranchPrefix",
      "rollbackBranchPrefix"
    ],
    "git"
  );
  assertKnownKeys(verification, ["logicTests", "uiEvidence"], "verification");
  assertKnownKeys(review, ["independentExecution"], "review");
  assertKnownKeys(qualityGates, ["regular", "continuous"], "qualityGates");
  assertKnownKeys(
    regularGates,
    ["audit", "independentReview", "check", "tryGuide"],
    "qualityGates.regular"
  );
  assertKnownKeys(
    continuousGates,
    ["audit", "independentReview", "check", "tryGuide"],
    "qualityGates.continuous"
  );
  assertKnownKeys(
    continuous,
    ["maxFeatures", "maxRepairAttempts", "finalIntegrationAudit"],
    "continuous"
  );

  return {
    schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
    workflow: {
      stepReview: optionalEnum(
        workflow.stepReview,
        ["every", "feature"],
        defaults.workflow.stepReview,
        "workflow.stepReview"
      ),
      checkpointCommits: optionalEnum(
        workflow.checkpointCommits,
        ["disabled", "enabled"],
        defaults.workflow.checkpointCommits,
        "workflow.checkpointCommits"
      )
    },
    git: {
      landing: optionalEnum(
        git.landing,
        ["local-merge", "pull-request"],
        defaults.git.landing,
        "git.landing"
      ),
      featureBranchPrefix: optionalBranchPrefix(
        git.featureBranchPrefix,
        defaults.git.featureBranchPrefix,
        "git.featureBranchPrefix"
      ),
      fixBranchPrefix: optionalBranchPrefix(
        git.fixBranchPrefix,
        defaults.git.fixBranchPrefix,
        "git.fixBranchPrefix"
      ),
      rollbackBranchPrefix: optionalBranchPrefix(
        git.rollbackBranchPrefix,
        defaults.git.rollbackBranchPrefix,
        "git.rollbackBranchPrefix"
      )
    },
    verification: {
      logicTests: optionalEnum(
        verification.logicTests,
        ["required", "when-configured"],
        defaults.verification.logicTests,
        "verification.logicTests"
      ),
      uiEvidence: optionalEnum(
        verification.uiEvidence,
        ["required", "when-available"],
        defaults.verification.uiEvidence,
        "verification.uiEvidence"
      )
    },
    review: {
      independentExecution: optionalEnum(
        review.independentExecution,
        ["automatic", "manual"],
        defaults.review.independentExecution,
        "review.independentExecution"
      )
    },
    qualityGates: {
      regular: parseQualityGatePolicy(
        regularGates,
        defaults.qualityGates.regular,
        "qualityGates.regular"
      ),
      continuous: parseQualityGatePolicy(
        continuousGates,
        defaults.qualityGates.continuous,
        "qualityGates.continuous"
      )
    },
    continuous: {
      maxFeatures: optionalNullablePositiveInteger(
        continuous.maxFeatures,
        defaults.continuous.maxFeatures,
        "continuous.maxFeatures"
      ),
      maxRepairAttempts: optionalBoundedInteger(
        continuous.maxRepairAttempts,
        defaults.continuous.maxRepairAttempts,
        "continuous.maxRepairAttempts",
        0,
        10
      ),
      finalIntegrationAudit: optionalBoolean(
        continuous.finalIntegrationAudit,
        defaults.continuous.finalIntegrationAudit,
        "continuous.finalIntegrationAudit"
      )
    }
  };
}

function parseQualityGatePolicy(
  value: Record<string, unknown>,
  defaults: QualityGatePolicy,
  label: string
): QualityGatePolicy {
  return {
    audit: optionalEnum(
      value.audit,
      ["always", "manual", "when-sensitive"],
      defaults.audit,
      `${label}.audit`
    ),
    independentReview: optionalEnum(
      value.independentReview,
      ["always", "manual", "when-sensitive"],
      defaults.independentReview,
      `${label}.independentReview`
    ),
    check: optionalEnum(
      value.check,
      ["always", "manual", "when-behavioral"],
      defaults.check,
      `${label}.check`
    ),
    tryGuide: optionalEnum(
      value.tryGuide,
      ["always", "manual", "when-user-facing"],
      defaults.tryGuide,
      `${label}.tryGuide`
    )
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown, label: string): Record<string, unknown> {
  return value === undefined ? {} : requireRecord(value, label);
}

function assertKnownKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const unknown = Object.keys(record).filter((key) => !allowed.includes(key));

  if (unknown.length > 0) {
    throw new Error(
      `${label} contains unknown key${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`
    );
  }
}

function optionalEnum<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  label: string
): T {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${label} must be one of: ${allowed.join(", ")}.`);
  }

  return value as T;
}

function optionalBranchPrefix(
  value: unknown,
  fallback: string,
  label: string
): string {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || !/^[a-z][a-z0-9-]*\/$/.test(value)) {
    throw new Error(
      `${label} must be a lowercase branch prefix ending in /, such as feature/.`
    );
  }

  return value;
}

function optionalNullablePositiveInteger(
  value: unknown,
  fallback: number | null,
  label: string
): number | null {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`${label} must be null or a positive integer.`);
  }

  return value as number;
}

function optionalBoundedInteger(
  value: unknown,
  fallback: number,
  label: string,
  minimum: number,
  maximum: number
): number {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isInteger(value) ||
    (value as number) < minimum ||
    (value as number) > maximum
  ) {
    throw new Error(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }

  return value as number;
}

function optionalBoolean(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be true or false.`);
  }

  return value;
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

export {
  PROJECT_CONFIG_PATH,
  PROJECT_CONFIG_SCHEMA_VERSION,
  createDefaultProjectConfig,
  parseProjectConfig,
  readProjectConfig
};

export type {
  AuditGatePolicy,
  CheckpointCommitPolicy,
  CheckGatePolicy,
  IndependentReviewGatePolicy,
  IndependentReviewExecution,
  LandingPolicy,
  LogicTestPolicy,
  ProjectConfig,
  ProjectConfigResult,
  ProjectConfigState,
  ProjectConfigWarning,
  QualityGatePolicy,
  StepReviewPolicy,
  TryGuideGatePolicy,
  UiEvidencePolicy
};
