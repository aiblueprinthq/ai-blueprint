import fs from "node:fs/promises";
import path from "node:path";

import { findProjectRoot } from "./project-root.js";
import { readManifest } from "./update.js";
import type { Adapter } from "./update.js";

const PROJECT_STATE_SCHEMA_VERSION = 1 as const;
type ProjectAdapter = Adapter;
type LegacyFilesystemAdapter = Exclude<ProjectAdapter, "copilot">;
const ADAPTER_ORDER: readonly ProjectAdapter[] = ["codex", "claude", "copilot"];

interface ProjectWarning {
  code: "invalid_manifest";
  message: string;
}

interface ProjectMetadata {
  schemaVersion: typeof PROJECT_STATE_SCHEMA_VERSION;
  project: {
    name: string;
    root: string;
  };
  blueprint: {
    version: string | null;
    adapters: ProjectAdapter[];
  };
  warnings: ProjectWarning[];
}

const ADAPTER_PATHS: Record<LegacyFilesystemAdapter, string> = {
  codex: path.join(".agents", "skills"),
  claude: path.join(".claude", "skills")
};

async function readProjectMetadata(
  startPath: string = process.cwd()
): Promise<ProjectMetadata> {
  const projectRoot = await findProjectRoot(startPath);

  if (!projectRoot) {
    throw new Error(`No AI Blueprint project found from: ${path.resolve(startPath)}`);
  }

  const warnings: ProjectWarning[] = [];
  let manifest = null;

  try {
    manifest = await readManifest(projectRoot);
  } catch (error: unknown) {
    warnings.push({
      code: "invalid_manifest",
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    schemaVersion: PROJECT_STATE_SCHEMA_VERSION,
    project: {
      name: path.basename(projectRoot),
      root: projectRoot
    },
    blueprint: {
      version: manifest?.version || null,
      adapters: await detectAdapters(projectRoot, manifest?.adapters)
    },
    warnings
  };
}

async function detectAdapters(
  projectRoot: string,
  manifestAdapters?: readonly ProjectAdapter[]
): Promise<ProjectAdapter[]> {
  if (manifestAdapters) {
    return ADAPTER_ORDER.filter((adapter) => manifestAdapters.includes(adapter));
  }

  const adapters: ProjectAdapter[] = [];

  for (const adapter of ["codex", "claude"] as const) {
    if (await isDirectory(path.join(projectRoot, ADAPTER_PATHS[adapter]))) {
      adapters.push(adapter);
    }
  }

  return adapters;
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await fs.lstat(targetPath)).isDirectory();
  } catch (error: unknown) {
    const code = getErrorCode(error);

    if (code === "ENOENT" || code === "ENOTDIR") {
      return false;
    }

    throw error;
  }
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
  PROJECT_STATE_SCHEMA_VERSION,
  detectAdapters,
  readProjectMetadata
};

export type { ProjectAdapter, ProjectMetadata, ProjectWarning };
