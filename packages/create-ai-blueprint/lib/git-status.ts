import { execFile } from "node:child_process";
import { promisify } from "node:util";

interface GitStatusSummary {
  available: boolean;
  branch: string | null;
  clean: boolean | null;
  changedFiles: number;
  lastCommit: string | null;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
}

const execFileAsync = promisify(execFile);

async function readGitStatus(projectRoot: string): Promise<GitStatusSummary> {
  if (!(await isGitRepository(projectRoot))) {
    return unavailableSummary();
  }

  const porcelain = await runOptionalGit(projectRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all"
  ]);
  if (porcelain === null) {
    return unavailableSummary();
  }

  const changedFiles = porcelain
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .length;
  const branch = await readBranch(projectRoot);
  const lastCommit = await runOptionalGit(projectRoot, [
    "log",
    "-1",
    "--format=%s"
  ]);
  const upstream = await runOptionalGit(projectRoot, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}"
  ]);
  const divergence = upstream
    ? await readDivergence(projectRoot)
    : { ahead: null, behind: null };

  return {
    available: true,
    branch,
    clean: changedFiles === 0,
    changedFiles,
    lastCommit,
    upstream,
    ahead: divergence.ahead,
    behind: divergence.behind
  };
}

async function isGitRepository(projectRoot: string): Promise<boolean> {
  return (await runOptionalGit(projectRoot, [
    "rev-parse",
    "--is-inside-work-tree"
  ])) === "true";
}

async function readBranch(projectRoot: string): Promise<string> {
  const branch = await runOptionalGit(projectRoot, [
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD"
  ]);
  return branch || "(detached HEAD)";
}

async function readDivergence(
  projectRoot: string
): Promise<Pick<GitStatusSummary, "ahead" | "behind">> {
  const counts = await runOptionalGit(projectRoot, [
    "rev-list",
    "--left-right",
    "--count",
    "HEAD...@{upstream}"
  ]);
  const match = counts?.match(/^(\d+)\s+(\d+)$/);

  return match
    ? { ahead: Number(match[1]), behind: Number(match[2]) }
    : { ahead: null, behind: null };
}

async function runOptionalGit(
  projectRoot: string,
  args: readonly string[]
): Promise<string | null> {
  try {
    return await runGit(projectRoot, args);
  } catch {
    return null;
  }
}

async function runGit(projectRoot: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  });
  return result.stdout.replace(/[\r\n]+$/, "");
}

function unavailableSummary(): GitStatusSummary {
  return {
    available: false,
    branch: null,
    clean: null,
    changedFiles: 0,
    lastCommit: null,
    upstream: null,
    ahead: null,
    behind: null
  };
}

export { readGitStatus };

export type { GitStatusSummary };
