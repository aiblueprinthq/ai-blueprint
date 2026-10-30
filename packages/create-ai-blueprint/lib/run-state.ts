import fs from "node:fs/promises";
import path from "node:path";

type RunStateKind = "idle" | "recorded" | "malformed";
type RunStatus = "running" | "blocked" | "ready" | "completed";
type RunMode = "manual" | "autopilot" | "continuous";
type RunBoundary = "read-only" | "reviewed" | "local-only";
type RunFreshness = "current" | "stale";

interface RunProgress {
  current: number;
  total: number;
  label: string;
}

interface RunFeature {
  id: string | null;
  title: string;
}

interface RunStateWarning {
  code:
    | "invalid_run_state_path"
    | "malformed_run_state"
    | "unsafe_run_state_path";
  message: string;
}

interface RunStateSummary {
  state: RunStateKind;
  mode: RunMode;
  command: string | null;
  status: RunStatus | null;
  freshness: RunFreshness | null;
  summary: string | null;
  detail: string | null;
  boundary: RunBoundary | null;
  startedAt: string | null;
  updatedAt: string | null;
  resumeCommand: string | null;
  progress: RunProgress | null;
  feature: RunFeature | null;
  warnings: RunStateWarning[];
}

const RUN_STATE_PATH = path.join("blueprint", ".state", "run.json");
const COMMAND_PATTERN = /^[a-z][a-z-]{0,31}$/;
const RUN_STATUSES = new Set<RunStatus>([
  "running",
  "blocked",
  "ready",
  "completed"
]);
const RUN_BOUNDARIES = new Set<RunBoundary>([
  "read-only",
  "reviewed",
  "local-only"
]);
const RUN_STALE_AFTER_MS = 60 * 60 * 1000;

async function readRunState(
  projectRoot: string,
  now: Date = new Date()
): Promise<RunStateSummary> {
  const runStatePath = path.join(projectRoot, RUN_STATE_PATH);

  try {
    const stats = await fs.lstat(runStatePath);

    if (stats.isSymbolicLink()) {
      return malformedSummary({
        code: "unsafe_run_state_path",
        message: "Dashboard run state is a symbolic link and was not read."
      });
    }

    if (!stats.isFile()) {
      return malformedSummary({
        code: "invalid_run_state_path",
        message: "Dashboard run state path is not a regular file."
      });
    }

    return parseRunState(await fs.readFile(runStatePath, "utf8"), now);
  } catch (error: unknown) {
    if (getErrorCode(error) === "ENOENT") {
      return idleSummary();
    }

    throw error;
  }
}

function parseRunState(value: string, now: Date = new Date()): RunStateSummary {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return malformedSummary({
      code: "malformed_run_state",
      message: "Dashboard run state is not valid JSON. Run /blueprint-doctor to inspect and reset blueprint/.state/run.json."
    });
  }

  if (!isRecord(parsed)) {
    return malformedRunState();
  }

  const command = readString(parsed.command);
  const status = readString(parsed.status) as RunStatus | null;
  const summary = readString(parsed.summary);
  const detail = readOptionalString(parsed.detail);
  const boundary = readOptionalString(parsed.boundary) as RunBoundary | null;
  const startedAt = readString(parsed.startedAt);
  const updatedAt = readString(parsed.updatedAt);
  const resumeCommand = readOptionalString(parsed.resumeCommand);
  const progress = parseProgress(parsed.progress);
  const feature = parseFeature(parsed.feature);

  if (
    parsed.schemaVersion !== 1 ||
    !command ||
    !COMMAND_PATTERN.test(command) ||
    !status ||
    !RUN_STATUSES.has(status) ||
    !summary ||
    !startedAt ||
    !updatedAt ||
    !isTimestamp(startedAt) ||
    !isTimestamp(updatedAt) ||
    Date.parse(startedAt) > Date.parse(updatedAt) ||
    (parsed.detail !== undefined && detail === null) ||
    (parsed.boundary !== undefined && (!boundary || !RUN_BOUNDARIES.has(boundary))) ||
    (parsed.resumeCommand !== undefined && resumeCommand === null) ||
    (parsed.progress !== undefined && progress === null) ||
    (parsed.feature !== undefined && feature === null)
  ) {
    return malformedRunState();
  }

  const freshness = status === "running" &&
      now.getTime() - Date.parse(updatedAt) > RUN_STALE_AFTER_MS
    ? "stale"
    : "current";
  return {
    state: "recorded",
    mode: command === "autopilot"
      ? "autopilot"
      : command === "continuous"
        ? "continuous"
        : "manual",
    command,
    status,
    freshness,
    summary,
    detail,
    boundary,
    startedAt,
    updatedAt,
    resumeCommand,
    progress,
    feature,
    warnings: []
  };
}

function parseProgress(value: unknown): RunProgress | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const label = readString(value.label);
  const current = value.current;
  const total = value.total;

  if (
    !label ||
    !Number.isInteger(current) ||
    !Number.isInteger(total) ||
    Number(current) < 0 ||
    Number(total) < 1 ||
    Number(current) > Number(total)
  ) {
    return null;
  }

  return { label, current: Number(current), total: Number(total) };
}

function parseFeature(value: unknown): RunFeature | null {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const id = readOptionalString(value.id);
  const title = readString(value.title);

  if (!title || (value.id !== undefined && id === null)) {
    return null;
  }

  return { id, title };
}

function malformedRunState(): RunStateSummary {
  return malformedSummary({
    code: "malformed_run_state",
    message: "Dashboard run state does not match schema version 1. Run /blueprint-doctor to inspect and reset blueprint/.state/run.json."
  });
}

function idleSummary(): RunStateSummary {
  return {
    state: "idle",
    mode: "manual",
    command: null,
    status: null,
    freshness: null,
    summary: null,
    detail: null,
    boundary: null,
    startedAt: null,
    updatedAt: null,
    resumeCommand: null,
    progress: null,
    feature: null,
    warnings: []
  };
}

function malformedSummary(warning: RunStateWarning): RunStateSummary {
  return {
    ...idleSummary(),
    state: "malformed",
    warnings: [warning]
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readOptionalString(value: unknown): string | null {
  return value === undefined ? null : readString(value);
}

function isTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : undefined;
}

export { RUN_STATE_PATH, parseRunState, readRunState };

export type {
  RunBoundary,
  RunFeature,
  RunFreshness,
  RunMode,
  RunProgress,
  RunStateKind,
  RunStateSummary,
  RunStateWarning,
  RunStatus
};
