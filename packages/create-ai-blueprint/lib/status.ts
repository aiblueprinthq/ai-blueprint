import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

import { readBuildPlan } from "./build-plan.js";
import type {
  BuildPlanItem,
  BuildPlanSummary
} from "./build-plan.js";
import { readCurrentWork } from "./current-work.js";
import type {
  CurrentWorkSummary,
  CurrentWorkType
} from "./current-work.js";
import { readFindings } from "./findings.js";
import type {
  Finding,
  FindingsSummary,
  FindingStatus
} from "./findings.js";
import { readGitStatus } from "./git-status.js";
import type { GitStatusSummary } from "./git-status.js";
import { readHistory } from "./history.js";
import type { HistoryItem, HistorySummary } from "./history.js";
import { readProjectConfig } from "./project-config.js";
import type {
  ProjectConfig,
  ProjectConfigState,
  QualityGatePolicy
} from "./project-config.js";
import { readProjectMetadata } from "./project-metadata.js";
import type { ProjectAdapter } from "./project-metadata.js";
import { readRunState } from "./run-state.js";
import type { RunMode, RunStateSummary } from "./run-state.js";
import { readIndependentReview } from "./review.js";
import type {
  IndependentReviewSummary,
  ReviewFreshness,
  ReviewState
} from "./review.js";

type OverviewState = "current" | "missing" | "stale" | "unknown";
type OnboardingState = "complete" | "needed" | "unknown";
type CompletionState = "blocked" | "idle" | "needs_verification" | "ready";

interface StatusWarning {
  code: string;
  message: string;
}

interface StatusBuildPlan {
  completed: number;
  remaining: number;
  total: number;
  nextItem: Pick<BuildPlanItem, "id" | "title"> | null;
  splitParents: Array<Pick<BuildPlanItem, "id" | "title">>;
  items: Array<Pick<BuildPlanItem, "id" | "title" | "checked">>;
}

interface StatusCurrentWork {
  state: CurrentWorkSummary["state"];
  type: CurrentWorkType | null;
  title: string | null;
  status: string | null;
  buildPlanItem: string | null;
  completed: number;
  remaining: number;
  total: number;
  nextStep: { title: string } | null;
  steps: Array<{ checked: boolean; title: string }>;
}

interface StatusHistory {
  total: number;
  items: Array<Pick<HistoryItem, "type" | "title" | "buildPlanItem" | "status">>;
}

interface StatusFindings {
  total: number;
  byStatus: Record<FindingStatus, number>;
  active: Array<Pick<Finding, "id" | "severity" | "status" | "title">>;
  blockers: Array<Pick<Finding, "id" | "severity" | "status" | "title">>;
}

interface StatusReview {
  state: ReviewState;
  freshness: ReviewFreshness;
  targetCommit: string | null;
  requestedReviewer: string | null;
  requestedModel: string | null;
  requestedExecution: string | null;
  reviewerAdapter: string | null;
  reviewerModel: string | null;
  actualExecution: string | null;
}

interface StatusOverview {
  state: OverviewState;
  reason: string | null;
}

interface StatusOnboarding {
  state: OnboardingState;
  reason: string | null;
}

interface StatusNextAction {
  command: string | null;
  reason: string;
}

interface StatusCompletion {
  state: CompletionState;
  blockers: string[];
}

interface WorkEvidence {
  verification: "verified" | "failed" | "incomplete" | "missing";
  recordFaults: Array<{ blocker: string; path: string }>;
}

interface StatusConfiguration {
  path: string;
  state: ProjectConfigState;
  values: ProjectConfig;
}

type StatusActivity = Omit<RunStateSummary, "warnings">;

interface HumanStatusOptions {
  color?: boolean;
}

interface TextStyle {
  bold: (value: string) => string;
  brightCyan: (value: string) => string;
  cyan: (value: string) => string;
  dim: (value: string) => string;
  green: (value: string) => string;
  red: (value: string) => string;
  yellow: (value: string) => string;
}

interface ProjectStatus {
  schemaVersion: 1;
  health: "ok" | "warning";
  project: {
    name: string;
    root: string;
  };
  blueprint: {
    version: string | null;
    adapters: ProjectAdapter[];
  };
  configuration: StatusConfiguration;
  onboarding: StatusOnboarding;
  activity: StatusActivity;
  plans: {
    overview: StatusOverview;
    build: StatusBuildPlan;
  };
  currentWork: StatusCurrentWork;
  history: StatusHistory;
  findings: StatusFindings;
  review: StatusReview;
  git: GitStatusSummary;
  completion: StatusCompletion;
  nextAction: StatusNextAction;
  warnings: StatusWarning[];
}

const PROJECT_PLAN_PATH = path.join("blueprint", "project-plan.md");
const BUILD_PLAN_PATH = path.join("blueprint", "build-plan.md");
const AGENTS_PATH = "AGENTS.md";
const ONBOARDING_SENTINEL = "<!-- blueprint:onboarding-required -->";
const LEGACY_ONBOARDING_MARKER =
  "For a standard Next.js project. Change or remove if you're using something else.";
const OVERVIEW_PATH = path.join(
  "blueprint",
  "context",
  "project-overview.md"
);
const OVERVIEW_SOURCE_HASH_PATTERN =
  /<!--\s*blueprint:source-hash\s+([a-f0-9]{64})\s*-->/i;

async function readProjectStatus(
  startPath: string = process.cwd()
): Promise<ProjectStatus> {
  const metadata = await readProjectMetadata(startPath);
  const [buildPlan, currentWork, findings, review, history, git, overviewResult, config, runState, onboardingResult] =
    await Promise.all([
      readBuildPlan(metadata.project.root),
      readCurrentWork(metadata.project.root),
      readFindings(metadata.project.root),
      readIndependentReview(metadata.project.root),
      readHistory(metadata.project.root),
      readGitStatus(metadata.project.root),
      readOverviewStatus(metadata.project.root),
      readProjectConfig(metadata.project.root),
      readRunState(metadata.project.root),
      readOnboardingStatus(metadata.project.root)
    ]);
  const warnings: StatusWarning[] = [
    ...metadata.warnings,
    ...config.warnings,
    ...buildPlan.warnings,
    ...currentWork.warnings,
    ...findings.warnings,
    ...review.warnings,
    ...runState.warnings,
    ...onboardingResult.warnings,
    ...overviewResult.warnings,
    ...findDrift(buildPlan, currentWork, git, config.values)
  ];
  const evidence = classifyWorkEvidence(currentWork, findings, review);
  const completion = selectCompletion(
    currentWork,
    findings,
    review,
    git,
    config.values,
    config.state,
    runState.mode,
    evidence
  );
  const nextAction = selectNextAction(
    formatRunState(runState),
    onboardingResult.onboarding,
    overviewResult.overview,
    buildPlan,
    currentWork,
    findings,
    review,
    config.values,
    config.state,
    runState.mode,
    evidence,
    completion
  );

  return {
    schemaVersion: metadata.schemaVersion,
    health: warnings.length > 0 || findings.blockers.length > 0 ||
      (currentWork.state === "active" && evidence.verification === "failed") ||
      isReviewBlocked(review, config.values, currentWork, runState.mode)
      ? "warning"
      : "ok",
    project: metadata.project,
    blueprint: metadata.blueprint,
    configuration: {
      path: config.path,
      state: config.state,
      values: config.values
    },
    onboarding: onboardingResult.onboarding,
    activity: formatRunState(runState),
    plans: {
      overview: overviewResult.overview,
      build: formatBuildPlan(buildPlan)
    },
    currentWork: formatCurrentWork(currentWork),
    history: formatHistory(history),
    findings: formatFindings(findings),
    review: formatReview(review),
    git,
    completion,
    nextAction,
    warnings
  };
}

function formatHumanStatus(
  status: ProjectStatus,
  options: HumanStatusOptions = {}
): string {
  const style = createTextStyle(options.color === true);
  const adapters = status.blueprint.adapters.length > 0
    ? status.blueprint.adapters.join(", ")
    : "none detected";
  const lines = [
    `${style.bold(style.cyan("Blueprint Status"))}  ${style.bold(status.project.name)}`,
    "",
    formatSection("Project", style),
    formatRow("Path", status.project.root, style),
    formatRow("Version", status.blueprint.version || "unknown", style),
    formatRow("Adapters", adapters, style),
    formatRow("Config", formatConfigValue(status.configuration.state), style),
    formatRow(
      "Review exec.",
      status.configuration.values.review.independentExecution,
      style
    ),
    formatRow("Onboarding", status.onboarding.state, style),
    formatRow(
      "Regular gates",
      formatQualityGates(status.configuration.values.qualityGates.regular),
      style
    ),
    formatRow(
      "Cont. gates",
      formatQualityGates(status.configuration.values.qualityGates.continuous),
      style
    ),
    "",
    formatSection("Progress", style),
    formatRow("Overview", formatOverviewValue(status.plans.overview, style), style),
    formatRow("Build plan", formatBuildPlanValue(status.plans.build, style), style),
    formatRow("Work", formatWorkValue(status.currentWork, style), style)
  ];

  if (status.activity.state === "recorded") {
    lines.push(formatRow("Activity", formatActivityValue(status.activity), style));
  }

  if (status.currentWork.state === "active") {
    lines.push(
      formatRow(
        "Steps",
        `${status.currentWork.completed}/${status.currentWork.total} complete`,
        style
      )
    );

    if (status.currentWork.nextStep) {
      lines.push(formatRow("Next step", status.currentWork.nextStep.title, style));
    }
  }

  lines.push(
    formatRow("History", `${status.history.total} archived`, style),
    formatRow("Findings", formatFindingsValue(status.findings, style), style),
    formatRow("Review", formatReviewValue(status.review, style), style),
    formatRow("Completion", formatCompletionValue(status.completion, style), style),
    "",
    formatSection("Git", style)
  );
  appendGitLines(lines, status.git, style);

  if (status.warnings.length > 0) {
    lines.push("", formatSection("Attention", style));

    for (const warning of status.warnings) {
      lines.push(`  ${style.yellow("!")} ${style.yellow(warning.message)}`);
    }
  }

  lines.push("", formatSection("Next action", style));

  if (status.nextAction.command) {
    lines.push(`  ${style.bold(style.brightCyan(status.nextAction.command))}`);
  }

  lines.push(`  ${status.nextAction.reason}`);
  return lines.join("\n");
}

function formatConfigValue(state: ProjectConfigState): string {
  if (state === "project") {
    return "project settings";
  }

  if (state === "invalid") {
    return "invalid, using defaults";
  }

  return "built-in defaults";
}

function formatQualityGates(gates: QualityGatePolicy): string {
  return [
    `audit ${gates.audit}`,
    `independent review ${gates.independentReview}`,
    `check ${gates.check}`,
    `try guide ${gates.tryGuide}`
  ].join(", ");
}

function shouldUseColor(
  isTTY: boolean | undefined = process.stdout.isTTY,
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return isTTY === true && !Object.hasOwn(environment, "NO_COLOR");
}

function formatSection(label: string, style: TextStyle): string {
  return style.bold(label);
}

function formatRow(label: string, value: string, style: TextStyle): string {
  return `  ${style.cyan(label.padEnd(14))}${value}`;
}

function formatOverviewValue(
  overview: StatusOverview,
  style: TextStyle
): string {
  return overview.state === "current"
    ? style.green("current")
    : style.yellow(overview.state);
}

function formatBuildPlanValue(
  build: StatusBuildPlan,
  style: TextStyle
): string {
  if (build.total === 0) {
    return style.yellow("not ready");
  }

  const progress = `${build.completed}/${build.total} complete`;
  return build.remaining === 0 ? style.green(progress) : progress;
}

function formatWorkValue(work: StatusCurrentWork, style: TextStyle): string {
  if (work.state === "idle") {
    return style.dim("none");
  }

  if (work.state === "malformed") {
    return style.red("present but malformed");
  }

  const type = work.type || "work";
  const identity = type === "feature" && work.buildPlanItem
    ? `${work.buildPlanItem} - ${work.title || "untitled"}`
    : work.title || "untitled";
  return style.brightCyan(`${type} ${identity}`);
}

function formatActivityValue(activity: StatusActivity): string {
  const command = activity.command ? `/${activity.command}` : "unknown";
  const progress = activity.progress
    ? `, ${activity.progress.current}/${activity.progress.total} ${activity.progress.label}`
    : "";
  const freshness = activity.freshness === "stale" ? ", possibly interrupted" : "";
  return `${command} ${activity.status || "unknown"}${progress}${freshness}`;
}

function formatFindingsValue(
  findings: StatusFindings,
  style: TextStyle
): string {
  if (findings.total === 0) {
    return style.green("none");
  }

  const activeGroups = new Map<string, string[]>();
  for (const finding of findings.active) {
    const key = `${finding.status} ${finding.severity}`;
    activeGroups.set(key, [...(activeGroups.get(key) || []), finding.id]);
  }
  const activeCounts = [...activeGroups.entries()].map(
    ([label, ids]) => `${ids.length} ${label} (${ids.join(", ")})`
  );
  const resolvedCounts = (["closed", "accepted", "invalid"] as const)
    .filter((status) => findings.byStatus[status] > 0)
    .map((status) => `${findings.byStatus[status]} ${status}`);
  const value = [...activeCounts, ...resolvedCounts].join(", ");

  if (findings.blockers.length > 0) {
    return style.red(value);
  }

  return findings.active.length > 0 ? style.yellow(value) : style.green(value);
}

function formatReviewValue(review: StatusReview, style: TextStyle): string {
  if (review.state === "none") {
    return style.dim("none");
  }

  if (review.state === "malformed") {
    return style.red("malformed");
  }

  const freshness = review.freshness === "current" ? "current" : review.freshness;
  const reviewer = review.reviewerAdapter || review.requestedReviewer;
  const model = review.reviewerModel || review.requestedModel;
  const execution = review.actualExecution || review.requestedExecution;
  const reviewerLabel = reviewer && model ? `${reviewer}/${model}` : reviewer || model;
  const details = [reviewerLabel, execution].filter(Boolean).join(", ");
  const value = details
    ? `${review.state}, ${freshness}, ${details}`
    : `${review.state}, ${freshness}`;

  return review.state === "passed" && review.freshness === "current"
    ? style.green(value)
    : style.yellow(value);
}

function formatCompletionValue(
  completion: StatusCompletion,
  style: TextStyle
): string {
  if (completion.state === "idle") {
    return style.dim("idle");
  }

  if (completion.state === "ready") {
    return style.green("ready");
  }

  if (completion.state === "needs_verification") {
    return style.yellow("needs verification");
  }

  return style.red(`blocked: ${completion.blockers.join("; ")}`);
}

function appendGitLines(
  lines: string[],
  git: GitStatusSummary,
  style: TextStyle
): void {
  if (!git.available) {
    lines.push(formatRow("Status", style.red("not a Git repository"), style));
    return;
  }

  const workingTree = git.clean
    ? style.green("clean")
    : style.yellow(
        `${git.changedFiles} changed ${git.changedFiles === 1 ? "file" : "files"}`
      );
  const remote = git.upstream
    ? `${git.upstream} (${git.ahead || 0} ahead, ${git.behind || 0} behind)`
    : "not configured";
  const coloredRemote = git.upstream && git.ahead === 0 && git.behind === 0
    ? style.green(remote)
    : style.yellow(remote);

  lines.push(
    formatRow("Branch", git.branch || "unknown", style),
    formatRow("Working tree", workingTree, style),
    formatRow("Remote", coloredRemote, style)
  );

  if (git.lastCommit) {
    lines.push(`  ${style.cyan("Last commit")}`, `    ${git.lastCommit}`);
  }
}

function createTextStyle(enabled: boolean): TextStyle {
  const paint = (code: number, value: string): string =>
    enabled ? `\u001b[${code}m${value}\u001b[0m` : value;

  return {
    bold: (value) => paint(1, value),
    brightCyan: (value) => paint(96, value),
    cyan: (value) => paint(36, value),
    dim: (value) => paint(2, value),
    green: (value) => paint(32, value),
    red: (value) => paint(31, value),
    yellow: (value) => paint(33, value)
  };
}

function formatBuildPlan(buildPlan: BuildPlanSummary): StatusBuildPlan {
  return {
    completed: buildPlan.completed,
    remaining: buildPlan.remaining,
    total: buildPlan.total,
    nextItem: selectBuildPlanItem(buildPlan.nextItem),
    splitParents: buildPlan.splitParents.map((item) => ({
      id: item.id,
      title: item.title
    })),
    items: buildPlan.leafItems.map((item) => ({
      id: item.id,
      title: item.title,
      checked: item.checked
    }))
  };
}

function formatCurrentWork(currentWork: CurrentWorkSummary): StatusCurrentWork {
  return {
    state: currentWork.state,
    type: currentWork.type,
    title: currentWork.title,
    status: currentWork.status,
    buildPlanItem: currentWork.buildPlanItem,
    completed: currentWork.completed,
    remaining: currentWork.remaining,
    total: currentWork.total,
    nextStep: currentWork.nextStep
      ? { title: currentWork.nextStep.title }
      : null,
    steps: currentWork.steps.map((step) => ({
      checked: step.checked,
      title: step.title
    }))
  };
}

function formatRunState(runState: RunStateSummary): StatusActivity {
  const { warnings: _warnings, ...activity } = runState;
  return activity;
}

function formatHistory(history: HistorySummary): StatusHistory {
  return {
    total: history.total,
    items: history.items.map((item) => ({
      type: item.type,
      title: item.title,
      buildPlanItem: item.buildPlanItem,
      status: item.status
    }))
  };
}

function formatFindings(findings: FindingsSummary): StatusFindings {
  const selectFinding = (
    finding: Finding
  ): Pick<Finding, "id" | "severity" | "status" | "title"> => ({
    id: finding.id,
    severity: finding.severity,
    status: finding.status,
    title: finding.title
  });

  return {
    total: findings.total,
    byStatus: findings.byStatus,
    active: findings.items
      .filter((finding) =>
        finding.status === "unverified" ||
        finding.status === "open" ||
        finding.status === "fixed"
      )
      .map(selectFinding),
    blockers: findings.blockers.map(selectFinding)
  };
}

function formatReview(review: IndependentReviewSummary): StatusReview {
  return {
    state: review.state,
    freshness: review.freshness,
    targetCommit: review.targetCommit,
    requestedReviewer: review.requestedReviewer,
    requestedModel: review.requestedModel,
    requestedExecution: review.requestedExecution,
    reviewerAdapter: review.reviewerAdapter,
    reviewerModel: review.reviewerModel,
    actualExecution: review.actualExecution
  };
}

function selectBuildPlanItem(
  item: BuildPlanItem | null
): Pick<BuildPlanItem, "id" | "title"> | null {
  return item ? { id: item.id, title: item.title } : null;
}

function selectCompletion(
  currentWork: CurrentWorkSummary,
  findings: FindingsSummary,
  review: IndependentReviewSummary,
  git: GitStatusSummary,
  config: ProjectConfig,
  configState: ProjectConfigState,
  runMode: RunMode,
  evidence: WorkEvidence
): StatusCompletion {
  if (currentWork.state === "idle") {
    return { state: "idle", blockers: [] };
  }

  if (currentWork.state === "malformed") {
    return {
      state: "blocked",
      blockers: ["current work contract is malformed"]
    };
  }

  const blockers = evidence.recordFaults.map((fault) => fault.blocker);

  if (evidence.verification === "failed") {
    blockers.push("verification failed");
  }

  if (configState === "invalid") {
    blockers.push("project configuration is invalid");
  }

  if (currentWork.remaining > 0) {
    blockers.push(`${currentWork.remaining} build steps remain`);
  }

  if (findings.blockers.length > 0) {
    blockers.push(
      `blocking findings ${findings.blockers.map((finding) => finding.id).join(", ")}`
    );
  }

  if (review.state === "pending") {
    blockers.push("independent review is pending");
  } else if (review.state === "changes-requested") {
    blockers.push("independent review requested changes");
  } else if (review.state === "passed" && review.freshness !== "current") {
    blockers.push("independent review receipt is stale or cannot be validated");
  } else if (
    review.state === "none" &&
    currentWork.state === "active" &&
    selectIndependentReviewPolicy(config, review, runMode) === "always"
  ) {
    blockers.push("independent review is required");
  }

  if (!git.available) {
    blockers.push("Git repository is unavailable");
  } else if (
    currentWork.type &&
    !isMatchingWorkBranch(git.branch, currentWork.type, config)
  ) {
    blockers.push(`branch does not match ${currentWork.type} work`);
  }

  if (blockers.length > 0) {
    return { state: "blocked", blockers };
  }

  if (evidence.verification === "verified") {
    return { state: "ready", blockers: [] };
  }

  return {
    state: "needs_verification",
    blockers: [evidence.verification === "incomplete"
      ? "verification is incomplete"
      : "verification evidence is not persisted"]
  };
}

function selectNextAction(
  activity: StatusActivity,
  onboarding: StatusOnboarding,
  overview: StatusOverview,
  buildPlan: BuildPlanSummary,
  currentWork: CurrentWorkSummary,
  findings: FindingsSummary,
  review: IndependentReviewSummary,
  config: ProjectConfig,
  configState: ProjectConfigState,
  runMode: RunMode,
  evidence: WorkEvidence,
  completion: StatusCompletion
): StatusNextAction {
  if (configState === "invalid") {
    return {
      command: "/doctor",
      reason: "Repair blueprint/config.json before running a mutating workflow."
    };
  }

  const activityAction = selectActivityNextAction(activity);
  if (activityAction?.command === null) {
    return activityAction;
  }

  if (currentWork.state === "malformed") {
    return {
      command: "/doctor",
      reason: "Repair the current-work contract before continuing."
    };
  }

  if (currentWork.state === "active") {
    if (evidence.recordFaults.length > 0) {
      return {
        command: "/doctor",
        reason: `Diagnose ${evidence.recordFaults.map((fault) => fault.path).join(" and ")} before continuing: ${evidence.recordFaults.map((fault) => fault.blocker).join("; ")}.`
      };
    }

    if (evidence.verification === "failed") {
      return {
        command: "/implement",
        reason: "Verification failed. Repair the current work before running /check again."
      };
    }
  }

  if (
    activityAction &&
    !(currentWork.state === "active" &&
      completion.state !== "ready" &&
      /^\/complete(?:\s|$)/i.test(activityAction.command || ""))
  ) {
    return activityAction;
  }

  if (onboarding.state === "unknown") {
    return {
      command: "/doctor",
      reason: onboarding.reason || "Confirm Blueprint onboarding state before continuing."
    };
  }

  if (onboarding.state === "needed") {
    return {
      command: "/onboard",
      reason: "Tune Blueprint for this project before generating project context."
    };
  }

  if (currentWork.state === "active") {
    if (currentWork.nextStep) {
      return {
        command: "/implement",
        reason: `Resume with ${currentWork.nextStep.title}.`
      };
    }

    const openBlocker = findings.blockers.find(
      (finding) => finding.status === "open"
    );
    if (openBlocker) {
      return {
        command: "/implement",
        reason: `Repair blocking finding ${openBlocker.id}.`
      };
    }

    const fixedBlocker = findings.blockers.find(
      (finding) => finding.status === "fixed"
    );
    if (fixedBlocker) {
      return {
        command: review.state === "pending" || review.state === "changes-requested"
          ? "/audit independent current"
          : "/audit",
        reason: `Re-review fixed finding ${fixedBlocker.id}.`
      };
    }

    if (evidence.verification !== "verified") {
      return {
        command: "/check",
        reason: evidence.verification === "incomplete"
          ? "Verification is incomplete. Finish checking the current work."
          : "All build steps are checked, but verification is not persisted."
      };
    }

    if (
      review.state === "pending" ||
      review.state === "changes-requested" ||
      (review.state === "passed" && review.freshness !== "current") ||
      (review.state === "none" && selectIndependentReviewPolicy(config, review, runMode) === "always")
    ) {
      return {
        command: "/audit independent current",
        reason: review.state === "pending"
          ? "Complete the pending review from the selected fresh reviewer context."
          : "Prepare or refresh the required independent review."
      };
    }

    if (completion.state !== "ready") {
      return {
        command: "/doctor",
        reason: `Resolve completion blockers before continuing: ${completion.blockers.join("; ")}.`
      };
    }

    return {
      command: "/complete",
      reason: "The current work is verified and ready for its final safety pass."
    };
  }

  if (overview.state !== "current") {
    return {
      command: "/overview",
      reason: "Refresh the project overview before starting feature work."
    };
  }

  const openBlocker = findings.blockers.find(
    (finding) => finding.status === "open"
  );
  if (openBlocker) {
    return {
      command: `/fix ${openBlocker.id}`,
      reason: "Start a tracked repair for the blocking finding."
    };
  }

  const fixedBlocker = findings.blockers.find(
    (finding) => finding.status === "fixed"
  );
  if (fixedBlocker) {
    return {
      command: "/audit",
      reason: `Re-review fixed finding ${fixedBlocker.id}.`
    };
  }

  if (buildPlan.nextItem) {
    return {
      command: buildPlan.nextItem.id
        ? `/feature ${buildPlan.nextItem.id}`
        : `/feature "${buildPlan.nextItem.title}"`,
      reason: `Spec the next build-plan item, ${buildPlan.nextItem.title}.`
    };
  }

  if (buildPlan.total > 0 && buildPlan.remaining === 0) {
    return {
      command: null,
      reason: "The current milestone is complete. Review hardening, release, documentation, or propose a new capability."
    };
  }

  return {
    command: "/doctor",
    reason: "The build plan is not ready for feature work."
  };
}

function isReviewBlocked(
  review: IndependentReviewSummary,
  config: ProjectConfig,
  currentWork: CurrentWorkSummary,
  runMode: RunMode
): boolean {
  return review.state === "malformed" ||
    review.state === "pending" ||
    review.state === "changes-requested" ||
    (review.state === "passed" && review.freshness !== "current") ||
    (review.state === "none" &&
      currentWork.state === "active" &&
      selectIndependentReviewPolicy(config, review, runMode) === "always");
}

function selectIndependentReviewPolicy(
  config: ProjectConfig,
  review: IndependentReviewSummary,
  runMode: RunMode
): QualityGatePolicy["independentReview"] {
  const workflow = review.workflow || (runMode === "continuous" ? "continuous" : "regular");
  return config.qualityGates[workflow].independentReview;
}

function selectActivityNextAction(
  activity: StatusActivity
): StatusNextAction | null {
  if (activity.state === "malformed") {
    return {
      command: "/doctor",
      reason: "Inspect and reset malformed dashboard state in blueprint/.state/run.json."
    };
  }

  if (activity.state !== "recorded" || !activity.command || !activity.status) {
    return null;
  }

  const command = `/${activity.command}`;

  if (activity.status === "running") {
    if (activity.freshness === "stale") {
      return {
        command: activity.resumeCommand || `${command} resume`,
        reason: `Recorded ${command} activity appears interrupted. Confirm the project state before resuming.`
      };
    }

    return {
      command: null,
      reason: `${command} is currently running.`
    };
  }

  if (activity.status === "blocked") {
    return {
      command: activity.resumeCommand || `${command} resume`,
      reason: activity.detail || `Resume the blocked ${command} workflow.`
    };
  }

  if (activity.status === "ready" && activity.resumeCommand) {
    return {
      command: activity.resumeCommand,
      reason: activity.detail || activity.summary || `${command} is ready for review.`
    };
  }

  if (activity.status === "ready" && activity.command === "autopilot") {
    return {
      command: "/complete",
      reason: activity.detail || "Review the Autopilot result before completing the current work."
    };
  }

  return null;
}

function classifyWorkEvidence(
  currentWork: CurrentWorkSummary,
  findings: FindingsSummary,
  review: IndependentReviewSummary
): WorkEvidence {
  const status = currentWork.status?.trim().toLowerCase();
  const verification = status === "verified"
    ? "verified"
    : status === "verification failed"
      ? "failed"
      : status === "verification incomplete"
        ? "incomplete"
        : "missing";
  const recordFaults: WorkEvidence["recordFaults"] = [];

  if (review.state === "malformed") {
    recordFaults.push({
      blocker: "independent review record is malformed",
      path: "blueprint/context/review.md"
    });
  }

  for (const warning of findings.warnings) {
    const blocker = warning.code === "malformed_findings"
      ? "findings record is malformed"
      : warning.code === "invalid_findings_path"
        ? "findings path is not a regular file"
        : warning.code === "unsafe_findings_path"
          ? "findings path is a symbolic link and was not read"
          : null;
    if (blocker) {
      recordFaults.push({ blocker, path: "blueprint/context/findings.md" });
    }
  }

  return { verification, recordFaults };
}

function findDrift(
  buildPlan: BuildPlanSummary,
  currentWork: CurrentWorkSummary,
  git: GitStatusSummary,
  config: ProjectConfig
): StatusWarning[] {
  if (currentWork.state !== "active") {
    return [];
  }

  const warnings: StatusWarning[] = [];

  if (git.available && (git.branch === "main" || git.branch === "master")) {
    warnings.push({
      code: "active_work_on_default_branch",
      message: `Active ${currentWork.type || "work"} is on the default branch.`
    });
  } else if (
    git.available &&
    currentWork.type &&
    !isMatchingWorkBranch(git.branch, currentWork.type, config)
  ) {
    warnings.push({
      code: "work_branch_mismatch",
      message: `Active ${currentWork.type} work does not match branch ${git.branch}.`
    });
  }

  if (currentWork.total > 0 && currentWork.remaining === 0) {
    warnings.push({
      code: "completed_steps_not_completed",
      message: "All current-work steps are checked, but the work has not been completed and archived."
    });
  }

  if (currentWork.type === "feature" && currentWork.buildPlanItem) {
    const matchingItem = buildPlan.items.find(
      (item) => item.id?.toLowerCase() === currentWork.buildPlanItem
    );

    if (!matchingItem) {
      warnings.push({
        code: "current_work_missing_from_build_plan",
        message: `Active feature ${currentWork.buildPlanItem} is not present in the build plan.`
      });
    } else if (matchingItem.checked) {
      warnings.push({
        code: "active_feature_already_checked",
        message: `Active feature ${currentWork.buildPlanItem} is already checked in the build plan.`
      });
    } else if (
      config.git.landing === "local-merge" &&
      buildPlan.nextItem?.id &&
      buildPlan.nextItem.id.toLowerCase() !== currentWork.buildPlanItem
    ) {
      warnings.push({
        code: "current_work_build_plan_mismatch",
        message: `Active feature ${currentWork.buildPlanItem} does not match next build-plan item ${buildPlan.nextItem.id}.`
      });
    }
  }

  return warnings;
}

function isMatchingWorkBranch(
  branch: string | null,
  type: CurrentWorkType,
  config: ProjectConfig
): boolean {
  const prefix = type === "feature"
    ? config.git.featureBranchPrefix
    : type === "fix"
      ? config.git.fixBranchPrefix
      : config.git.rollbackBranchPrefix;
  return branch?.startsWith(prefix) === true;
}

async function readOnboardingStatus(projectRoot: string): Promise<{
  onboarding: StatusOnboarding;
  warnings: StatusWarning[];
}> {
  const agentsPath = path.join(projectRoot, AGENTS_PATH);

  try {
    const stats = await fs.lstat(agentsPath);

    if (stats.isSymbolicLink() || !stats.isFile()) {
      const reason = "AGENTS.md is not a regular project file.";
      return {
        onboarding: { state: "unknown", reason },
        warnings: [{ code: "invalid_agents_file", message: reason }]
      };
    }

    const content = await fs.readFile(agentsPath, "utf8");
    if (
      content.includes(ONBOARDING_SENTINEL) ||
      content.includes(LEGACY_ONBOARDING_MARKER)
    ) {
      const reason = "Blueprint onboarding has not tuned the project commands yet.";
      return {
        onboarding: { state: "needed", reason },
        warnings: [{ code: "onboarding_incomplete", message: reason }]
      };
    }

    return {
      onboarding: { state: "complete", reason: null },
      warnings: []
    };
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      const reason = "AGENTS.md is missing, so onboarding state cannot be confirmed.";
      return {
        onboarding: { state: "unknown", reason },
        warnings: [{ code: "missing_agents_file", message: reason }]
      };
    }

    throw error;
  }
}

async function readOverviewStatus(
  projectRoot: string
): Promise<{ overview: StatusOverview; warnings: StatusWarning[] }> {
  const warnings: StatusWarning[] = [];
  const overview = await readFileMtime(projectRoot, OVERVIEW_PATH);
  const projectPlan = await readFileMtime(projectRoot, PROJECT_PLAN_PATH);
  const buildPlan = await readFileMtime(projectRoot, BUILD_PLAN_PATH);

  if (overview.kind !== "file") {
    const message = fileStateMessage("Project overview", overview.kind);
    warnings.push({ code: `${overview.kind}_overview`, message });
    return {
      overview: {
        state: overview.kind === "missing" ? "missing" : "unknown",
        reason: message
      },
      warnings
    };
  }

  for (const [label, result] of [
    ["Project plan", projectPlan],
    ["Build plan", buildPlan]
  ] as const) {
    if (result.kind !== "file") {
      warnings.push({
        code: `${result.kind}_${label.toLowerCase().replace(" ", "_")}`,
        message: fileStateMessage(label, result.kind)
      });
    }
  }

  if (projectPlan.kind !== "file" || buildPlan.kind !== "file") {
    return {
      overview: {
        state: "unknown",
        reason: "Overview freshness cannot be confirmed because a planning file is unavailable."
      },
      warnings
    };
  }

  const [overviewContent, projectPlanContent, buildPlanContent] =
    await Promise.all([
      fs.readFile(path.join(projectRoot, OVERVIEW_PATH), "utf8"),
      fs.readFile(path.join(projectRoot, PROJECT_PLAN_PATH), "utf8"),
      fs.readFile(path.join(projectRoot, BUILD_PLAN_PATH), "utf8")
    ]);
  const recordedHash = overviewContent.match(OVERVIEW_SOURCE_HASH_PATTERN)?.[1]
    ?.toLowerCase() || null;

  if (!recordedHash) {
    const message = "Project overview has no plan fingerprint. Run /overview once to establish reliable freshness.";
    warnings.push({ code: "unfingerprinted_overview", message });
    return {
      overview: { state: "unknown", reason: message },
      warnings
    };
  }

  const currentHash = createOverviewSourceHash(
    projectPlanContent,
    buildPlanContent
  );
  const legacyCurrentHash = createLegacyOverviewSourceHash(
    projectPlanContent,
    buildPlanContent
  );

  if (recordedHash !== currentHash && recordedHash !== legacyCurrentHash) {
    const message = "Project overview does not match the current project and build plans.";
    warnings.push({ code: "stale_overview", message });
    return {
      overview: { state: "stale", reason: message },
      warnings
    };
  }

  return {
    overview: { state: "current", reason: null },
    warnings
  };
}

function createOverviewSourceHash(
  projectPlan: string,
  buildPlan: string
): string {
  const normalizedBuildPlan = buildPlan.replace(
    /^([ \t]*-[ \t]+)\[[xX]\]/gm,
    "$1[ ]"
  );

  return createLegacyOverviewSourceHash(projectPlan, normalizedBuildPlan);
}

function createLegacyOverviewSourceHash(
  projectPlan: string,
  buildPlan: string
): string {
  return createHash("sha256")
    .update(projectPlan, "utf8")
    .update(Buffer.from([0]))
    .update(buildPlan, "utf8")
    .digest("hex");
}

type FileMtimeResult =
  | { kind: "file"; mtimeMs: number }
  | { kind: "invalid" | "missing" | "unsafe" };

async function readFileMtime(
  projectRoot: string,
  relativePath: string
): Promise<FileMtimeResult> {
  try {
    const stats = await fs.lstat(path.join(projectRoot, relativePath));

    if (stats.isSymbolicLink()) {
      return { kind: "unsafe" };
    }

    return stats.isFile()
      ? { kind: "file", mtimeMs: stats.mtimeMs }
      : { kind: "invalid" };
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      return { kind: "missing" };
    }

    throw error;
  }
}

function fileStateMessage(
  label: string,
  kind: Exclude<FileMtimeResult["kind"], "file">
): string {
  if (kind === "missing") {
    return `${label} is missing.`;
  }

  if (kind === "unsafe") {
    return `${label} is a symbolic link and was not inspected.`;
  }

  return `${label} path is not a regular file.`;
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
  createOverviewSourceHash,
  formatHumanStatus,
  readProjectStatus,
  shouldUseColor
};

export type {
  CompletionState,
  HumanStatusOptions,
  OnboardingState,
  OverviewState,
  ProjectStatus,
  StatusConfiguration,
  StatusBuildPlan,
  StatusActivity,
  StatusCompletion,
  StatusCurrentWork,
  StatusFindings,
  StatusHistory,
  StatusNextAction,
  StatusOnboarding,
  StatusOverview,
  StatusReview,
  StatusWarning
};
