#!/usr/bin/env node

import checkbox from "@inquirer/checkbox";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { openDashboard, startDashboardServer } from "../lib/dashboard.js";
import {
  formatHumanStatus,
  readProjectStatus,
  shouldUseColor
} from "../lib/status.js";
import {
  CONTROL_DIR,
  MANIFEST_PATH,
  adapterListFromMode,
  applyPreparedUpdate,
  managedRootsForAdapters,
  prepareUpdate,
  readInstalledAdapters,
  writeInstallManifest
} from "../lib/update.js";
import type { Adapter, PreparedUpdate, UpdateResult } from "../lib/update.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = findPackageRoot(__dirname);
const templateRoot = path.join(packageRoot, "template");
const ADAPTER_PROMPT = "Select AI tool adapters";
const ALL_ADAPTERS = adapterListFromMode("all");
const AI_SKILLS = new Set([
  "adopt", "audit", "autopilot", "blueprint-doctor", "blueprint-status", "brief",
  "check", "ci", "complete", "continuous", "debug", "discovery", "explore", "feature",
  "fix", "implement", "onboard", "overview", "prototype", "release", "rollback", "tests"
]);

interface AdapterCheckboxChoice {
  name: string;
  value: Adapter;
  checked: boolean;
}

interface AdapterCheckboxConfig {
  message: string;
  choices: readonly AdapterCheckboxChoice[];
  required: boolean;
}

type AdapterCheckbox = (config: AdapterCheckboxConfig) => Promise<Adapter[]>;

interface CliOptions {
  adapters: Adapter[] | null;
  command: "dashboard" | "install" | "status" | "update";
  deprecatedBoth: boolean;
  deprecatedUi: boolean;
  dryRun: boolean;
  force: boolean;
  help: boolean;
  json: boolean;
  open: boolean;
  target: string | null;
  version: boolean;
  yes: boolean;
}

interface TemplateEntry {
  source: string;
  target: string;
}

type GlobalCliAction = "install" | "update" | null;
type CliSurface = "package" | "global";

const adapterChoices = new Set<Adapter>(ALL_ADAPTERS);

async function runCli(
  args: readonly string[] = process.argv.slice(2),
  surface: CliSurface = "package"
): Promise<void> {
  if (surface === "global" && args.length === 0) {
    printGlobalHelp();
    return;
  }

  const options = parseArgs(args, surface);

  if (options.help) {
    printCommandHelp(options.command, surface);
    return;
  }

  if (options.version) {
    console.log(readPackageVersion());
    return;
  }

  if (options.deprecatedUi) {
    console.warn("Warning: `ui` is deprecated; use `dashboard` instead.");
  }

  if (
    surface === "global" &&
    options.command !== "status" &&
    options.command !== "dashboard"
  ) {
    throw new Error(
      "The global blueprint command supports project status and the local dashboard only. Use `npx create-ai-blueprint@latest` to install Blueprint or `npx create-ai-blueprint@latest update` to update it."
    );
  }

  const targetDir = path.resolve(process.cwd(), options.target || ".");

  if (options.command === "status") {
    const status = await readProjectStatus(targetDir);
    console.log(
      options.json
        ? JSON.stringify(status, null, 2)
        : formatHumanStatus(status, { color: shouldUseColor() })
    );
    return;
  }

  if (options.command === "dashboard") {
    const dashboard = await startDashboardServer(targetDir);
    console.log(`Blueprint dashboard: ${dashboard.url}`);
    console.log("Press Ctrl+C to stop.");

    if (options.open) {
      try {
        await openDashboard(dashboard.url);
      } catch (error: unknown) {
        console.warn(
          `Could not open the browser automatically: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    await waitForShutdown();
    await dashboard.close();
    return;
  }

  if (!fsSync.existsSync(templateRoot)) {
    throw new Error(formatMissingTemplateMessage(templateRoot));
  }

  const version = readPackageVersion();

  if (options.deprecatedBoth) {
    console.warn("Warning: --both is deprecated; use --all instead.");
  }

  if (options.command === "update") {
    const installedAdapters = await readInstalledAdapters(targetDir);
    const adapters = await resolveUpdateAdapters(options, installedAdapters);
    const prepared = await prepareUpdate({
      targetDir,
      templateRoot,
      version,
      adapters
    });
    printUpdatePlan(prepared);

    if (options.dryRun) {
      return;
    }

    const replaceConflicts =
      options.force || (await confirmUpdateConflicts(prepared, options));
    const result = await applyPreparedUpdate(prepared, { replaceConflicts });
    printUpdateSuccess(prepared, result);
    await offerGlobalCliInstall(options, version);
    return;
  }

  const presentation =
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true &&
    process.env.TERM !== "dumb";
  if (presentation && !options.dryRun) {
    printInstallWelcome(version);
  }

  const adapters = await resolveAdapters(options);
  const entries = getTemplateEntries(adapters);
  await validateInstallDestinations(entries, targetDir);
  const existingEntries = entries.filter((entry) =>
    fsSync.existsSync(path.join(targetDir, entry.target))
  );

  if (options.dryRun) {
    printPlan(targetDir, adapters, entries, existingEntries);
    return;
  }

  await confirmOverwrite(existingEntries, options);

  for (const entry of entries) {
    await copyTemplateEntry(entry, targetDir);
  }

  await writeInstallManifest({
    targetDir,
    templateRoot,
    version,
    adapters
  });

  printSuccess(targetDir, adapters, entries, existingEntries, presentation);
  await offerGlobalCliInstall(options, version);
  printOnboardingNextSteps(adapters, presentation);
}

function parseArgs(args: readonly string[], surface: CliSurface = "package"): CliOptions {
  const options: CliOptions = {
    adapters: null,
    command: "install",
    deprecatedBoth: false,
    deprecatedUi: false,
    dryRun: false,
    force: false,
    help: false,
    json: false,
    open: true,
    target: null,
    version: false,
    yes: false
  };

  const adapterFlags: Adapter[] = [];
  let allAdapters = false;
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "init") {
      continue;
    }

    if (arg === "status" || arg === "dashboard" || arg === "ui" || arg === "update") {
      if (commandSeen) {
        throw new Error("Choose only one command.");
      }

      if (arg === "ui") {
        options.command = "dashboard";
        options.deprecatedUi = true;
      } else {
        options.command = arg;
      }
      commandSeen = true;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      options.version = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--no-open") {
      options.open = false;
      continue;
    }

    if (arg === "--force" || arg === "-f") {
      options.force = true;
      continue;
    }

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }

    if (arg === "--both") {
      options.deprecatedBoth = true;
      allAdapters = true;
      continue;
    }

    if (arg === "--all") {
      allAdapters = true;
      continue;
    }

    if (
      arg === "--claude" ||
      arg === "--codex" ||
      arg === "--copilot" ||
      arg === "--opencode" ||
      arg === "--antigravity"
    ) {
      adapterFlags.push(arg.slice(2) as Adapter);
      continue;
    }

    if (arg === "--target" || arg === "-t") {
      const next = args[index + 1];
      if (!next) {
        throw new Error(`${arg} needs a directory path.`);
      }
      options.target = next;
      index += 1;
      continue;
    }

    if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
      continue;
    }

    if (!commandSeen && arg === "browser-tests") {
      throw new Error(
        "The browser-tests skill was removed. Open your project in your AI chat and run `$tests browser` in Codex or `/tests browser` in Claude Code."
      );
    }

    if (!commandSeen && arg === "try") {
      throw new Error(
        "The try skill was removed. Open your project in your AI chat and run `$check guide` in Codex or `/check guide` in Claude Code."
      );
    }

    if (!commandSeen && arg === "doctor") {
      throw new Error(
        "The doctor skill is now blueprint-doctor. Open your project in your AI chat and run `$blueprint-doctor` in Codex or `/blueprint-doctor` in Claude Code."
      );
    }

    if (!commandSeen && AI_SKILLS.has(arg)) {
      throw new Error(
        `\`${arg}\` is an AI chat skill, not a terminal command. Open your project in your AI tool and run \`$${arg}\` in Codex or \`/${arg}\` in Claude Code.`
      );
    }

    const binary = surface === "global" ? "blueprint" : "npx create-ai-blueprint@latest";
    const command = options.command === "install" ? "" : ` ${options.command}`;
    throw new Error(`Unknown option: ${arg}\nRun \`${binary}${command} --help\` for usage.`);
  }

  if (allAdapters && adapterFlags.length > 0) {
    throw new Error(
      "Do not combine --all or --both with individual adapter flags."
    );
  }

  options.adapters = allAdapters
    ? [...ALL_ADAPTERS]
    : adapterFlags.length > 0
      ? ALL_ADAPTERS.filter((adapter) => adapterFlags.includes(adapter))
      : null;

  if (options.command !== "status" && options.json) {
    throw new Error("--json is available only with the status command.");
  }

  if (
    options.command === "status" &&
    (options.adapters || options.dryRun || options.force || options.yes || !options.open)
  ) {
    throw new Error(
      "Status accepts only --json, --target, --help, and --version options."
    );
  }

  if (
    options.command === "dashboard" &&
    (options.adapters || options.dryRun || options.force || options.yes)
  ) {
    throw new Error(
      "Dashboard accepts only --target, --no-open, --help, and --version options."
    );
  }

  if (options.command !== "dashboard" && !options.open) {
    throw new Error("--no-open is available only with the dashboard command.");
  }

  return options;
}

async function resolveAdapters(
  options: CliOptions,
  prompt: AdapterCheckbox = checkbox as AdapterCheckbox,
  isTTY: boolean | undefined = process.stdin.isTTY
): Promise<Adapter[]> {
  if (options.adapters) {
    return options.adapters;
  }

  if (options.yes || !isTTY) {
    return [...ALL_ADAPTERS];
  }

  return prompt({
    message: ADAPTER_PROMPT,
    choices: [
      { name: "Codex", value: "codex", checked: true },
      { name: "Claude Code", value: "claude", checked: true },
      { name: "GitHub Copilot", value: "copilot", checked: false },
      { name: "OpenCode", value: "opencode", checked: false },
      { name: "Google Antigravity", value: "antigravity", checked: false }
    ],
    required: true
  });
}

async function resolveUpdateAdapters(
  options: CliOptions,
  installed: readonly Adapter[],
  prompt: AdapterCheckbox = checkbox as AdapterCheckbox,
  isTTY: boolean | undefined = process.stdin.isTTY
): Promise<Adapter[]> {
  if (options.adapters) {
    return [...new Set([...installed, ...options.adapters])].sort();
  }

  if (options.yes || !isTTY) {
    return [...installed];
  }

  return prompt({
    message: ADAPTER_PROMPT,
    choices: [
      { name: "Codex", value: "codex", checked: installed.includes("codex") },
      { name: "Claude Code", value: "claude", checked: installed.includes("claude") },
      { name: "GitHub Copilot", value: "copilot", checked: installed.includes("copilot") },
      { name: "OpenCode", value: "opencode", checked: installed.includes("opencode") },
      {
        name: "Google Antigravity",
        value: "antigravity",
        checked: installed.includes("antigravity")
      }
    ],
    required: true
  });
}

function getTemplateEntries(adapters: readonly Adapter[]): TemplateEntry[] {
  if (adapters.length === 0 || adapters.some((adapter) => !adapterChoices.has(adapter))) {
    throw new Error(`Unknown or empty adapter selection: ${adapters.join(", ")}`);
  }

  const entries = [
    { source: "AGENTS.md", target: "AGENTS.md" },
    { source: "blueprint", target: "blueprint" }
  ];

  const managedRoots = managedRootsForAdapters(adapters);

  if (managedRoots.includes(".agents/skills")) {
    entries.push({ source: ".agents", target: ".agents" });
  }

  if (managedRoots.includes(".claude/skills")) {
    entries.push({ source: "CLAUDE.md", target: "CLAUDE.md" });
    entries.push({ source: ".claude", target: ".claude" });
  }

  return entries;
}

async function confirmOverwrite(
  existingEntries: readonly TemplateEntry[],
  options: CliOptions
): Promise<void> {
  if (existingEntries.length === 0 || options.force) {
    return;
  }

  if (options.yes || !process.stdin.isTTY) {
    throw new Error(
      `Existing Blueprint files found: ${existingEntries
        .map((entry) => entry.target)
        .join(", ")}. Re-run with --force to overwrite them.`
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log("Existing Blueprint files found:");
    for (const entry of existingEntries) {
      console.log(`- ${entry.target}`);
    }

    const answer = await rl.question("Overwrite matching Blueprint files? [y/N] ");

    if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
      throw new Error("Install cancelled.");
    }
  } finally {
    rl.close();
  }
}

async function confirmUpdateConflicts(
  prepared: PreparedUpdate,
  options: CliOptions
): Promise<boolean> {
  const count = prepared.plan.conflicts.length;

  if (count === 0) {
    return false;
  }

  if (options.yes || !process.stdin.isTTY) {
    throw new Error(
      `${count} managed file conflict${count === 1 ? "" : "s"} found. Run the update interactively to review them, or pass --force to back them up and replace them.`
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const answer = await rl.question(
      `Back up and replace ${count} conflicting managed file${count === 1 ? "" : "s"}? [y/N] `
    );
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

async function copyTemplateEntry(entry: TemplateEntry, targetDir: string): Promise<void> {
  const source = path.join(templateRoot, entry.source);
  const target = path.join(targetDir, entry.target);
  await copyPath(source, target);
}

async function validateInstallDestinations(
  entries: readonly TemplateEntry[],
  targetDir: string
): Promise<void> {
  await assertDestinationType(targetDir, "directory");

  for (const entry of entries) {
    await validateTemplateDestination(
      path.join(templateRoot, entry.source),
      path.join(targetDir, entry.target)
    );
  }

  await assertDestinationType(path.join(targetDir, CONTROL_DIR), "directory");
  await assertDestinationType(path.join(targetDir, MANIFEST_PATH), "file");
  await assertDestinationType(path.join(targetDir, CONTROL_DIR, ".gitignore"), "file");
}

async function validateTemplateDestination(source: string, target: string): Promise<void> {
  const stats = await fs.stat(source);

  if (stats.isDirectory()) {
    await assertDestinationType(target, "directory");

    for (const child of await fs.readdir(source)) {
      await validateTemplateDestination(path.join(source, child), path.join(target, child));
    }
  } else if (stats.isFile()) {
    await assertDestinationType(target, "file");
  }
}

async function assertDestinationType(target: string, expected: "directory" | "file"): Promise<void> {
  let stats;

  try {
    stats = await fs.lstat(target);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ENOENT") {
        let parent = path.dirname(target);

        while (parent !== path.dirname(parent)) {
          try {
            const parentStats = await fs.stat(parent);

            if (!parentStats.isDirectory()) {
              throw new Error(`Refusing to install at ${target}: a parent path is not a directory.`);
            }

            break;
          } catch (parentError: unknown) {
            if (
              parentError instanceof Error &&
              "code" in parentError &&
              parentError.code === "ENOENT"
            ) {
              parent = path.dirname(parent);
              continue;
            }

            throw parentError;
          }
        }

        return;
      }

      if (error.code === "ENOTDIR") {
        throw new Error(`Refusing to install at ${target}: a parent path is not a directory.`);
      }
    }

    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new Error(`Refusing to install through symbolic-link path: ${target}`);
  }

  if (expected === "directory" ? !stats.isDirectory() : !stats.isFile()) {
    throw new Error(`Refusing to install at ${target}: expected a ${expected}.`);
  }
}

async function copyPath(source: string, target: string): Promise<void> {
  const stats = await fs.stat(source);

  if (stats.isDirectory()) {
    await fs.mkdir(target, { recursive: true });
    const children = await fs.readdir(source);

    for (const child of children) {
      await copyPath(path.join(source, child), path.join(target, child));
    }

    return;
  }

  if (stats.isFile()) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
}

function printPlan(
  targetDir: string,
  adapters: readonly Adapter[],
  entries: readonly TemplateEntry[],
  existingEntries: readonly TemplateEntry[]
): void {
  console.log(`Target: ${targetDir}`);
  console.log(`Adapters: ${adapters.join(", ")}`);
  console.log("Would copy:");

  for (const entry of entries) {
    console.log(`- ${entry.target}`);
  }

  if (existingEntries.length > 0) {
    console.log("Would overwrite matching files under:");
    for (const entry of existingEntries) {
      console.log(`- ${entry.target}`);
    }
  }
}

function getOpenCodeSkillsRoot(adapters: readonly Adapter[]): string {
  return managedRootsForAdapters(adapters).includes(".claude/skills")
    ? ".claude/skills"
    : ".agents/skills";
}

function printUpdatePlan(prepared: PreparedUpdate): void {
  const { plan } = prepared;
  console.log("AI Blueprint update plan.");
  console.log(`Target: ${prepared.targetDir}`);
  console.log(`Adapters: ${prepared.adapters.join(", ")}`);

  if (prepared.addedAdapters.length > 0) {
    console.log(`Adding adapters: ${prepared.addedAdapters.join(", ")}`);
  }

  if (prepared.removedAdapters.length > 0) {
    console.log(`Removing adapters: ${prepared.removedAdapters.join(", ")}`);
  }

  if (
    prepared.previousAdapters.includes("opencode") &&
    prepared.adapters.includes("opencode")
  ) {
    const previousRoot = getOpenCodeSkillsRoot(prepared.previousAdapters);
    const nextRoot = getOpenCodeSkillsRoot(prepared.adapters);

    if (
      previousRoot !== nextRoot &&
      !managedRootsForAdapters(prepared.adapters).includes(previousRoot)
    ) {
      console.log(`OpenCode skills move from ${previousRoot} to ${nextRoot}.`);
    }
  }

  if (prepared.claudeEntrypoint === "create") {
    console.log("CLAUDE.md is missing and will be created from the template.");
  } else if (prepared.claudeEntrypoint === "preserve") {
    console.log("The existing CLAUDE.md is kept as is; make sure it imports @AGENTS.md.");
  }

  if (prepared.removedAdapters.includes("claude")) {
    console.log("CLAUDE.md is preserved; delete it manually if it is no longer needed.");
  }

  console.log(`Version: ${prepared.previousVersion} -> ${prepared.version}`);
  console.log(`Add: ${plan.add.length}`);
  console.log(`Update: ${plan.update.length}`);
  console.log(`Remove: ${plan.remove.length}`);
  console.log(`Conflicts: ${plan.conflicts.length}`);
  console.log(`Unchanged: ${plan.unchanged.length}`);

  if (plan.conflicts.length > 0) {
    console.log("Conflicting managed files:");
    for (const conflict of plan.conflicts) {
      console.log(`- ${conflict.path} (${conflict.reason})`);
    }
  }

  console.log(
    "Preserved: AGENTS.md, CLAUDE.md, project configuration, plans, context, history, references, and prototypes."
  );

  if (prepared.staleClaudeImports.length > 0) {
    console.log("");
    console.log("Claude Code context cleanup recommended.");
    console.log(
      "After the update succeeds, remove these obsolete import lines from the preserved CLAUDE.md:"
    );
    for (const line of prepared.staleClaudeImports) {
      console.log(`- ${line}`);
    }
    console.log("Then restart Claude Code in this project.");
  }
}

function styleInstall(value: string, code: string): string {
  return shouldUseColor() ? `\u001b[${code}m${value}\u001b[0m` : value;
}

function printInstallWelcome(version: string): void {
  const mark = [" ___  ___", "| _ )| _ \\", "| _ \\|  _/", "|___/|_|"];
  const title = ["", "AI Blueprint", `v${version}`, ""];
  const compact = (process.stdout.columns || 80) < 32;
  console.log("");
  for (const [index, line] of mark.entries()) {
    const label = compact ? "" : styleInstall(title[index], "1");
    console.log(`  ${styleInstall(line.padEnd(11), "36")}${label}`);
  }
  if (compact) {
    console.log(`  ${styleInstall("AI Blueprint", "1")}`);
    console.log(`  v${version}`);
  }
  console.log("");
  console.log(compact ? "  An AI coding workflow." : "  A workflow for your AI coding tools.");
  console.log("");
}

function printSuccess(
  targetDir: string,
  adapters: readonly Adapter[],
  entries: readonly TemplateEntry[],
  existingEntries: readonly TemplateEntry[],
  presentation: boolean
): void {
  if (presentation) {
    console.log("");
  }
  console.log(
    presentation
      ? styleInstall("  + AI Blueprint installed.", "1;36")
      : "AI Blueprint installed."
  );
  console.log(`Target: ${targetDir}`);
  console.log(`Adapters: ${adapters.join(", ")}`);
  console.log(presentation ? styleInstall("\nInstalled files", "1") : "Copied:");

  for (const entry of entries) {
    console.log(`- ${entry.target}`);
  }
  console.log(`- ${MANIFEST_PATH}`);

  if (existingEntries.length > 0) {
    console.log("Overwrote matching Blueprint files where paths already existed.");
  }

  console.log("");
  console.log("Your app README was left alone.");
}

function printOnboardingNextSteps(
  adapters: readonly Adapter[],
  presentation: boolean
): void {
  console.log("");
  if (presentation) {
    const rule = "-".repeat(Math.min(process.stdout.columns || 48, 48));
    console.log(styleInstall(rule, "34"));
    console.log(styleInstall("NEXT: AI chat command", "1;36"));
    console.log("Open this project in your AI tool.");
    console.log("Then send this in its chat:");
    console.log("");
    console.log(styleInstall(getNextCommand(adapters, true), "1"));
    console.log(styleInstall(rule, "34"));
  } else {
    console.log("Next: run onboard");
    console.log(getNextCommand(adapters));
  }
  printClaudeRestartNote(adapters);
  console.log(
    "If a different skill loads, tell the agent to follow the local Blueprint skill file directly."
  );
}

function printUpdateSuccess(prepared: PreparedUpdate, result: UpdateResult): void {
  console.log("AI Blueprint updated.");
  console.log(`Version: ${prepared.previousVersion} -> ${prepared.version}`);

  if (prepared.addedAdapters.length > 0) {
    console.log(`Added adapters: ${prepared.addedAdapters.join(", ")}`);
  }

  if (prepared.removedAdapters.length > 0) {
    console.log(`Removed adapters: ${prepared.removedAdapters.join(", ")}`);
  }

  console.log(`Added: ${result.added}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Removed: ${result.removed}`);
  console.log(`Unchanged: ${result.unchanged}`);

  if (result.createdClaudeEntrypoint) {
    console.log("Created: CLAUDE.md");
  }

  if (result.backupDir) {
    console.log(`Backup: ${path.relative(prepared.targetDir, result.backupDir)}`);
  }

  console.log(
    "Preserved user-owned plans, context, history, references, prototypes, AGENTS.md, and CLAUDE.md."
  );
  printClaudeRestartNote(prepared.addedAdapters);
}

function getNextCommand(adapters: readonly Adapter[], includeLabels = false): string {
  const instructions: Record<Adapter, { label: string; command: string }> = {
    codex: { label: "Codex", command: "$onboard" },
    claude: { label: "Claude Code", command: "/onboard" },
    copilot: {
      label: "GitHub Copilot",
      command: "Ask Copilot to run the onboard skill."
    },
    opencode: {
      label: "OpenCode",
      command: "Ask OpenCode to run the onboard skill."
    },
    antigravity: {
      label: "Google Antigravity",
      command: "/onboard"
    }
  };
  const selected = ALL_ADAPTERS
    .filter((adapter) => adapters.includes(adapter))
    .map((adapter) => instructions[adapter]);

  if (selected.length === 1 && !includeLabels) {
    return selected[0].command;
  }

  return selected
    .map((instruction) => `- ${instruction.label}: ${instruction.command}`)
    .join("\n");
}

function printClaudeRestartNote(adapters: readonly Adapter[]): void {
  if (!adapters.includes("claude")) {
    return;
  }

  console.log(
    "Claude Code: if this project was already open, restart Claude Code in this folder so /onboard appears."
  );
}

async function offerGlobalCliInstall(
  options: CliOptions,
  version: string
): Promise<void> {
  if (!shouldOfferGlobalCliInstall(options)) {
    return;
  }

  const installedVersion = await readGlobalCliVersion();
  const action = selectGlobalCliAction(installedVersion, version);

  if (!action) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  let answer = "";

  try {
    answer = await rl.question(getGlobalCliPrompt(action, installedVersion, version));
  } finally {
    rl.close();
  }

  if (!isGlobalCliInstallConfirmed(answer)) {
    return;
  }

  try {
    await installGlobalCli(version);
    console.log("\nOptional global CLI ready.");
  } catch (error: unknown) {
    console.error(
      `\nGlobal CLI was not installed or updated: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function selectGlobalCliAction(
  installedVersion: string | null,
  targetVersion: string
): GlobalCliAction {
  if (installedVersion === targetVersion) {
    return null;
  }

  return installedVersion ? "update" : "install";
}

async function readGlobalCliVersion(): Promise<string | null> {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const args = npmExecPath
    ? [npmExecPath, "root", "--global"]
    : ["root", "--global"];

  try {
    const globalRoot = (await readCommandOutput(command, args)).trim();
    if (!globalRoot) {
      return null;
    }

    const packageJson = await fs.readFile(
      path.join(globalRoot, "create-ai-blueprint", "package.json"),
      "utf8"
    );
    const metadata: unknown = JSON.parse(packageJson);

    return typeof metadata === "object" &&
      metadata !== null &&
      typeof (metadata as { version?: unknown }).version === "string"
      ? (metadata as { version: string }).version
      : null;
  } catch {
    return null;
  }
}

async function readCommandOutput(
  command: string,
  args: readonly string[]
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "ignore"]
    });
    let output = "";

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve(output);
        return;
      }

      reject(
        new Error(
          signal
            ? `npm stopped with signal ${signal}`
            : `npm exited with code ${code ?? "unknown"}`
        )
      );
    });
  });
}

function shouldOfferGlobalCliInstall(
  options: CliOptions,
  isTTY: boolean | undefined = process.stdin.isTTY,
  sourceCheckout: boolean = isSourceCheckout()
): boolean {
  return (
    (options.command === "install" || options.command === "update") &&
    !options.yes &&
    isTTY === true &&
    !sourceCheckout
  );
}

function isGlobalCliInstallConfirmed(answer: string): boolean {
  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

function getGlobalCliInstallCommand(version: string): string {
  return `npm install --global create-ai-blueprint@${version}`;
}

function getGlobalCliPrompt(
  action: Exclude<GlobalCliAction, null>,
  installedVersion: string | null,
  targetVersion: string
): string {
  const question = action === "install"
    ? "Install the optional global `blueprint` CLI command?"
    : `Update the optional global \`blueprint\` CLI from ${installedVersion} to ${targetVersion}?`;

  return `\n${question}
This adds the shorter \`blueprint status\` and \`blueprint dashboard\` commands.
Without it, use:
  npx create-ai-blueprint@latest status
  npx create-ai-blueprint@latest dashboard
This runs: ${getGlobalCliInstallCommand(targetVersion)}
Continue? [y/N]: `;
}

async function installGlobalCli(version: string): Promise<void> {
  const npmExecPath = process.env.npm_execpath;
  const packageSpec = `create-ai-blueprint@${version}`;
  const command = npmExecPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const args = npmExecPath
    ? [npmExecPath, "install", "--global", packageSpec]
    : ["install", "--global", packageSpec];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `npm stopped with signal ${signal}`
            : `npm exited with code ${code ?? "unknown"}`
        )
      );
    });
  });
}

async function waitForShutdown(): Promise<void> {
  await new Promise<void>((resolve) => {
    const stop = (): void => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };

    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

function printCommandHelp(command: CliOptions["command"], surface: CliSurface): void {
  const binary = surface === "global" ? "blueprint" : "npx create-ai-blueprint@latest";

  if (command === "status") {
    console.log(`${binary} status

Read Blueprint project status without changing project files.

Usage:
  ${binary} status [options]

Options:
  --json          Print status as one JSON object
  --target, -t    Project directory, defaults to the current directory
  --help, -h      Show status help
  --version, -v   Show package version

Examples:
  ${binary} status
  ${binary} status --json --target ./my-app`);
    return;
  }

  if (command === "dashboard") {
    console.log(`${binary} dashboard

Serve the local, read-only Blueprint dashboard. Opens a browser by default.
Press Ctrl+C to stop the server.

Usage:
  ${binary} dashboard [options]

Options:
  --target, -t    Project directory, defaults to the current directory
  --no-open       Start without opening a browser
  --help, -h      Show dashboard help
  --version, -v   Show package version

Examples:
  ${binary} dashboard
  ${binary} dashboard --no-open --target ./my-app`);
    return;
  }

  if (command === "update" && surface === "global") {
    console.log(`blueprint update

The global blueprint command does not install or update Blueprint.
Use the installer to update your project:
  npx create-ai-blueprint@latest update
  npx create-ai-blueprint@latest update --help`);
    return;
  }

  if (command === "update") {
    printUpdateHelp();
    return;
  }

  surface === "global" ? printGlobalHelp() : printHelp();
}

function printUpdateHelp(): void {
  console.log(`create-ai-blueprint update

Update managed Blueprint files while preserving project-owned plans and rules.
Adapter flags add to the installed set. To remove adapters, run interactively
without adapter flags or --yes and deselect them in the checkbox.
Non-interactive updates keep installed adapters unless flags add more.
Modified managed files are conflicts: the update stops without writing unless you
confirm replacement interactively or use --force. --force backs them up before
replacing or removing them.

Usage:
  npx create-ai-blueprint@latest update [options]

Options:
  --codex          Add Codex to the installed adapters
  --claude         Add Claude Code to the installed adapters
  --copilot        Add GitHub Copilot to the installed adapters
  --opencode       Add OpenCode to the installed adapters
  --antigravity    Add Google Antigravity to the installed adapters
  --all            Add every supported adapter; do not combine with adapter flags
  --both           Deprecated alias for --all
  --target, -t     Project directory, defaults to the current directory
  --force, -f      Back up and replace or remove conflicting managed files
  --yes, -y        Skip prompts, keeping installed adapters unless flags add more
  --dry-run        Preview file and adapter changes without writing files
  --help, -h       Show update help
  --version, -v    Show package version

Examples:
  npx create-ai-blueprint@latest update
  npx create-ai-blueprint@latest update --codex --dry-run
  npx create-ai-blueprint@latest update --target ./my-app --yes`);
}

function printHelp(): void {
  console.log(`create-ai-blueprint

Install AI Blueprint into an already scaffolded app.

Usage:
  npx create-ai-blueprint@latest
  npx create-ai-blueprint@latest update
  npx create-ai-blueprint@latest update -- --codex
  npx create-ai-blueprint@latest status
  npx create-ai-blueprint@latest status --json
  npx create-ai-blueprint@latest dashboard
  npx create-ai-blueprint@latest -- --codex
  npx create-ai-blueprint@latest -- --claude
  npx create-ai-blueprint@latest -- --copilot
  npx create-ai-blueprint@latest -- --opencode
  npx create-ai-blueprint@latest -- --antigravity
  npx create-ai-blueprint@latest -- --codex --opencode
  npx create-ai-blueprint@latest -- --all
  npx create-ai-blueprint@latest -- --both

Options:
  --codex          Add Codex on install, or add it to the installed adapters on update
  --claude         Add Claude Code on install, or add it to the installed adapters on update
  --copilot        Add GitHub Copilot on install, or add it to the installed adapters on update
  --opencode       Add OpenCode on install, or add it to the installed adapters on update
  --antigravity    Add Google Antigravity on install, or add it to the installed adapters on update
  --all            Install every supported adapter
  --both           Deprecated alias for --all
  --target, -t     Target directory, defaults to the current directory
  --force, -f      Install: overwrite matching files. Update: back up and replace managed conflicts
  --yes, -y        Use defaults in non-interactive installs
  --dry-run        Print what would be copied without writing files
  --json            Print status as one JSON object
  --no-open         Start the local dashboard without opening a browser
  --help, -h       Show help
  --version, -v    Show package version`);
}

function printGlobalHelp(): void {
  console.log(`blueprint

Read AI Blueprint project status and run its local dashboard.

This optional global command does not install or update Blueprint.

Usage:
  blueprint status
  blueprint status --json
  blueprint status --target ./my-app
  blueprint dashboard
  blueprint dashboard --no-open

Options:
  --target, -t     Project directory, defaults to the current directory
  --json            Print status as one JSON object
  --no-open         Start the local dashboard without opening a browser
  --help, -h       Show help
  --version, -v    Show package version

Install or update Blueprint with:
  npx create-ai-blueprint@latest
  npx create-ai-blueprint@latest update`);
}

// Correct for both layouts: dist/bin/ when published, bin/ in a source checkout.
// Relies on nothing between the entry point and the package root carrying its own
// package.json, so a build that emits dist/package.json would break this.
function findPackageRoot(startDir: string): string {
  let current = startDir;

  for (;;) {
    if (fsSync.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error(
        `Could not locate the installer package root above ${startDir}.`
      );
    }

    current = parent;
  }
}

function isSourceCheckout(root: string = packageRoot): boolean {
  return fsSync.existsSync(path.join(root, "scripts", "prepare-template.ts"));
}

function formatMissingTemplateMessage(templateRoot: string): string {
  return `Installer template is missing.
Looked in: ${templateRoot}
This looks like a source checkout, where the template is a build artifact.
Run \`npm run link:local\` from the repository root, or \`npm run prepare-template\` inside the installer package.`;
}

function readPackageVersion(): string {
  const packageJson = fsSync.readFileSync(
    path.join(packageRoot, "package.json"),
    "utf8"
  );
  const packageMetadata: unknown = JSON.parse(packageJson);

  if (
    typeof packageMetadata !== "object" ||
    packageMetadata === null ||
    typeof (packageMetadata as { version?: unknown }).version !== "string"
  ) {
    throw new Error("Package metadata has no valid version.");
  }

  return (packageMetadata as { version: string }).version;
}

if (
  process.argv[1] &&
  fsSync.realpathSync(process.argv[1]) === fsSync.realpathSync(fileURLToPath(import.meta.url))
) {
  runCli().catch((error: unknown) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

export {
  ADAPTER_PROMPT,
  findPackageRoot,
  formatMissingTemplateMessage,
  getGlobalCliInstallCommand,
  getGlobalCliPrompt,
  getTemplateEntries,
  isGlobalCliInstallConfirmed,
  parseArgs,
  resolveAdapters,
  resolveUpdateAdapters,
  runCli,
  selectGlobalCliAction,
  shouldOfferGlobalCliInstall
};
