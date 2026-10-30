#!/usr/bin/env node

// Standalone ESM because installed projects may use CommonJS.
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ACTIONS = new Set(["start", "update", "finish", "reset"]);
const BOUNDARIES = new Set(["read-only", "reviewed", "local-only"]);
const COMMAND_PATTERN = /^[a-z][a-z-]{0,31}$/;
const RUN_PATH = path.join("blueprint", ".state", "run.json");
const STATUSES = new Set(["running", "blocked", "ready", "completed"]);
const MAX_LENGTHS = {
  detail: 1000,
  featureId: 80,
  featureTitle: 160,
  progressLabel: 80,
  resumeCommand: 240,
  summary: 240
};

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const projectRoot = await findProjectRoot(options.target);

  if (options.action === "reset") {
    await resetState(projectRoot);
    console.log("Dashboard activity reset.");
    return;
  }

  const previous = options.action === "start"
    ? null
    : await readState(projectRoot);
  const state = buildState(options, previous, new Date().toISOString());
  await writeState(projectRoot, state);
  console.log(`Recorded /${state.command}: ${state.status} - ${state.summary}`);
}

function parseArgs(args) {
  const options = {
    action: null,
    boundary: null,
    command: null,
    current: null,
    detail: null,
    featureId: null,
    featureTitle: null,
    help: false,
    label: null,
    resumeCommand: null,
    status: null,
    summary: null,
    target: null,
    total: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (ACTIONS.has(arg)) {
      if (options.action) {
        throw new Error("Choose only one run-state action.");
      }
      options.action = arg;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--command") {
      options.command = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--summary") {
      options.summary = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--detail") {
      options.detail = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--boundary") {
      options.boundary = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--status") {
      options.status = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--resume") {
      options.resumeCommand = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--feature-id") {
      options.featureId = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--feature-title") {
      options.featureTitle = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--current") {
      options.current = readInteger(args, ++index, arg);
      continue;
    }
    if (arg === "--total") {
      options.total = readInteger(args, ++index, arg);
      continue;
    }
    if (arg === "--label") {
      options.label = readValue(args, ++index, arg);
      continue;
    }
    if (arg === "--target" || arg === "-t") {
      options.target = readValue(args, ++index, arg);
      continue;
    }

    throw new Error(`Unknown run-state option: ${arg}`);
  }

  validateOptions(options);
  return options;
}

function validateOptions(options) {
  if (options.help) {
    return;
  }
  if (!options.action) {
    throw new Error("Choose one run-state action: start, update, finish, or reset.");
  }

  const progressCount = [options.current, options.total, options.label]
    .filter((value) => value !== null).length;
  if (progressCount !== 0 && progressCount !== 3) {
    throw new Error("Progress requires --current, --total, and --label together.");
  }
  if (options.featureId && !options.featureTitle) {
    throw new Error("--feature-id requires --feature-title.");
  }

  if (options.action === "reset") {
    const unsupported = [
      options.boundary,
      options.command,
      options.current,
      options.detail,
      options.featureId,
      options.featureTitle,
      options.label,
      options.resumeCommand,
      options.status,
      options.summary,
      options.total
    ].some((value) => value !== null);
    if (unsupported) {
      throw new Error("Reset accepts only --target and --help.");
    }
    return;
  }

  if (options.action === "start") {
    if (!options.command || !options.summary || !options.boundary) {
      throw new Error("Start requires --command, --summary, and --boundary.");
    }
    if (options.status) {
      throw new Error("Start always records running status.");
    }
    return;
  }

  if (options.command) {
    throw new Error("Only start accepts --command.");
  }
  if (options.boundary) {
    throw new Error("Only start accepts --boundary.");
  }
  if (options.action === "finish") {
    if (options.status && !["ready", "completed"].includes(options.status)) {
      throw new Error("Finish status must be ready or completed.");
    }
    return;
  }
  if (options.status && !["running", "blocked", "ready"].includes(options.status)) {
    throw new Error("Update status must be running, blocked, or ready.");
  }

  const hasUpdate = [
    options.current,
    options.detail,
    options.featureTitle,
    options.resumeCommand,
    options.status,
    options.summary
  ].some((value) => value !== null);
  if (!hasUpdate) {
    throw new Error("Update needs at least one changed activity field.");
  }
}

function buildState(options, previous, timestamp) {
  if (options.action === "start") {
    const state = {
      schemaVersion: 1,
      command: requireText(options.command, "command", 32),
      status: "running",
      summary: requireText(options.summary, "summary", MAX_LENGTHS.summary),
      boundary: requireBoundary(options.boundary),
      startedAt: timestamp,
      updatedAt: timestamp
    };
    applyOptionalFields(state, options);
    return validateState(state);
  }

  const state = {
    ...previous,
    status: options.action === "finish"
      ? options.status || "completed"
      : options.status || previous.status,
    summary: options.summary
      ? requireText(options.summary, "summary", MAX_LENGTHS.summary)
      : previous.summary,
    updatedAt: timestamp
  };
  applyOptionalFields(state, options);

  if (
    options.action === "finish" ||
    (previous.status === "blocked" && state.status !== "blocked")
  ) {
    if (!options.resumeCommand) {
      delete state.resumeCommand;
    }
    if (!options.detail) {
      delete state.detail;
    }
  }

  return validateState(state);
}

function applyOptionalFields(state, options) {
  if (options.detail) {
    state.detail = requireText(options.detail, "detail", MAX_LENGTHS.detail);
  }
  if (options.resumeCommand) {
    state.resumeCommand = requireText(
      options.resumeCommand,
      "resume command",
      MAX_LENGTHS.resumeCommand
    );
  }
  if (options.current !== null) {
    state.progress = validateProgress({
      current: options.current,
      total: options.total,
      label: options.label
    });
  }
  if (options.featureTitle) {
    state.feature = {
      id: options.featureId,
      title: requireText(
        options.featureTitle,
        "feature title",
        MAX_LENGTHS.featureTitle
      )
    };
    if (state.feature.id !== null) {
      state.feature.id = requireText(
        state.feature.id,
        "feature ID",
        MAX_LENGTHS.featureId
      );
    }
  }
}

function validateState(value) {
  if (!isRecord(value)) {
    throw new Error("Run state must be an object.");
  }
  if (
    value.schemaVersion !== 1 ||
    typeof value.command !== "string" ||
    !COMMAND_PATTERN.test(value.command) ||
    !STATUSES.has(value.status) ||
    !isBoundedText(value.summary, MAX_LENGTHS.summary) ||
    typeof value.startedAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    Number.isNaN(Date.parse(value.startedAt)) ||
    Number.isNaN(Date.parse(value.updatedAt)) ||
    Date.parse(value.startedAt) > Date.parse(value.updatedAt) ||
    (value.boundary !== undefined && !BOUNDARIES.has(value.boundary)) ||
    (value.detail !== undefined && !isBoundedText(value.detail, MAX_LENGTHS.detail)) ||
    (value.resumeCommand !== undefined &&
      !isBoundedText(value.resumeCommand, MAX_LENGTHS.resumeCommand)) ||
    (value.progress !== undefined && !isValidProgress(value.progress)) ||
    (value.feature !== undefined && !isValidFeature(value.feature))
  ) {
    throw new Error("Run state does not match dashboard schema version 1.");
  }

  return value;
}

function validateProgress(progress) {
  if (!isValidProgress(progress)) {
    throw new Error(
      "Progress requires integers where 0 <= current <= total and total >= 1."
    );
  }
  return {
    current: progress.current,
    total: progress.total,
    label: progress.label.trim()
  };
}

function isValidProgress(value) {
  return isRecord(value) &&
    Number.isInteger(value.current) &&
    Number.isInteger(value.total) &&
    value.current >= 0 &&
    value.total >= 1 &&
    value.current <= value.total &&
    isBoundedText(value.label, MAX_LENGTHS.progressLabel);
}

function isValidFeature(value) {
  return isRecord(value) &&
    (value.id === null || isBoundedText(value.id, MAX_LENGTHS.featureId)) &&
    isBoundedText(value.title, MAX_LENGTHS.featureTitle);
}

async function findProjectRoot(target) {
  let current = path.resolve(process.cwd(), target || ".");
  const initial = await fs.lstat(current);
  if (initial.isFile()) {
    current = path.dirname(current);
  }

  while (true) {
    const blueprintPath = path.join(current, "blueprint");
    try {
      const blueprint = await fs.lstat(blueprintPath);
      if (blueprint.isSymbolicLink() || !blueprint.isDirectory()) {
        throw new Error("Blueprint path must be a real directory.");
      }
      const statePath = path.join(blueprintPath, ".state");
      const state = await fs.lstat(statePath);
      if (state.isSymbolicLink() || !state.isDirectory()) {
        throw new Error("Blueprint state path must be a real directory.");
      }
      return current;
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not find a Blueprint project with blueprint/.state.");
    }
    current = parent;
  }
}

async function readState(projectRoot) {
  const filePath = path.join(projectRoot, RUN_PATH);
  await requireRegularFile(filePath);

  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    throw new Error("Existing dashboard state is malformed. Start a new run or use /blueprint-doctor.");
  }
  return validateState(parsed);
}

async function writeState(projectRoot, state) {
  const filePath = path.join(projectRoot, RUN_PATH);
  await requireRegularOrMissing(filePath);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(validateState(state), null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 }
    );
    await fs.rename(temporaryPath, filePath);
    validateState(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function resetState(projectRoot) {
  const filePath = path.join(projectRoot, RUN_PATH);
  try {
    await requireRegularFile(filePath);
    await fs.rm(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function requireRegularFile(filePath) {
  const stats = await fs.lstat(filePath);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error("Dashboard run state must be a regular file.");
  }
}

async function requireRegularOrMissing(filePath) {
  try {
    await requireRegularFile(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function requireBoundary(value) {
  if (!BOUNDARIES.has(value)) {
    throw new Error("Boundary must be read-only, reviewed, or local-only.");
  }
  return value;
}

function requireText(value, label, maxLength) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function isBoundedText(value, maxLength) {
  return typeof value === "string" &&
    value.trim() !== "" &&
    value.length <= maxLength;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readValue(args, index, flag) {
  const value = args[index];
  if (!value) {
    throw new Error(`${flag} needs a value.`);
  }
  return value;
}

function readInteger(args, index, flag) {
  const value = readValue(args, index, flag);
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} needs a non-negative integer.`);
  }
  return Number(value);
}

function printHelp() {
  console.log(`Blueprint dashboard activity helper

Usage:
  node <helper> start --command feature --summary "Specifying feature 3" --boundary reviewed
  node <helper> update --status blocked --summary "A product decision is required" --resume "/feature 3"
  node <helper> finish --status ready --summary "Feature specification ready"
  node <helper> reset

Options:
  --command         Blueprint command name, required for start
  --summary         Short activity summary
  --detail          Concise safe detail
  --boundary        read-only, reviewed, or local-only
  --status          update: running, blocked, or ready; finish: ready or completed
  --resume          Safe recovery command
  --feature-id      Build-plan feature ID
  --feature-title   Feature, fix, or rollback title
  --current         Completed progress count
  --total           Total progress count
  --label           Progress unit label
  --target, -t      Project directory, defaults to the current directory
  --help, -h        Show help`);
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
