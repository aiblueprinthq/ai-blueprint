import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { promisify } from "node:util";
import { runInNewContext } from "node:vm";

import {
  DASHBOARD_HOST,
  startDashboardServer
} from "../lib/dashboard.js";
import { createOverviewSourceHash } from "../lib/status.js";

const execFileAsync = promisify(execFile);

test("dashboard serves live read-only project status on loopback", async (t) => {
  const projectRoot = await createProject(t);
  const dashboard = await startDashboardServer(projectRoot);
  t.after(() => dashboard.close());

  assert.match(dashboard.url, new RegExp(`^http://${DASHBOARD_HOST}:\\d+$`));

  const pageResponse = await fetch(dashboard.url);
  const page = await pageResponse.text();
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get("content-type") || "", /^text\/html/);
  assert.match(pageResponse.headers.get("content-security-policy") || "", /connect-src 'self'/);
  assert.equal(pageResponse.headers.get("cache-control"), "no-store");
  assert.match(page, /Blueprint Dashboard/);
  assert.match(page, /--paper: #f5f6f3/);
  assert.match(page, /--blue: #155eef/);
  assert.match(page, /:root\[data-theme="dark"\]/);
  assert.match(page, /--paper: #0d1211/);
  assert.match(page, /id="theme-toggle"[^>]+aria-label="Use dark theme"/);
  assert.match(page, /class="theme-icon-moon"/);
  assert.match(page, /class="theme-icon-sun"/);
  assert.match(page, /<div class="header-actions">[\s\S]+id="live-state"[\s\S]+id="theme-toggle"[\s\S]+<\/div>\s+<\/header>/);
  assert.match(page, /blueprint_dashboard_theme/);
  assert.equal(resolveInitialTheme(page, "", true), "dark");
  assert.equal(resolveInitialTheme(page, "", false), "light");
  assert.equal(resolveInitialTheme(page, "blueprint_dashboard_theme=light", true), "light");
  assert.equal(resolveInitialTheme(page, "blueprint_dashboard_theme=dark", false), "dark");
  assert.deepEqual(loadInitialTheme(page, "", true), {
    theme: "dark",
    renewedCookie: undefined
  });
  assert.deepEqual(loadInitialTheme(page, "blueprint_dashboard_theme=dark", false), {
    theme: "dark",
    renewedCookie: "blueprint_dashboard_theme=dark; Max-Age=31536000; Path=/; SameSite=Lax"
  });
  assert.deepEqual(toggleDashboardTheme(page, "light"), {
    theme: "dark",
    cookie: "blueprint_dashboard_theme=dark; Max-Age=31536000; Path=/; SameSite=Lax",
    label: "Use light theme",
    title: "Use light theme"
  });
  assert.deepEqual(toggleDashboardTheme(page, "dark"), {
    theme: "light",
    cookie: "blueprint_dashboard_theme=light; Max-Age=31536000; Path=/; SameSite=Lax",
    label: "Use dark theme",
    title: "Use dark theme"
  });
  assert.match(page, /class="brand-mark"[^>]+aria-hidden="true"/);
  assert.match(page, /<section class="code-panel next-action"/);
  assert.match(page, /id="activity-panel"[^>]+hidden/);
  assert.match(page, /<section class="dashboard-grid"/);
  assert.match(page, /<h2 class="section-title">Project state<\/h2>/);
  assert.match(page, /<div class="fact"><span>Config<\/span><span id="config">-<\/span><\/div>/);
  assert.match(page, /id="onboarding">-<\/span>/);
  assert.match(page, /id="regular-gates">-<\/span>/);
  assert.match(page, /id="continuous-gates">-<\/span>/);
  assert.match(page, /id="review-execution">-<\/span>/);
  assert.match(page, /id="health-list" aria-live="polite"/);
  assert.match(page, /<table class="findings-table">/);
  const findingsTable = page.match(/<table class="findings-table">[\s\S]+?<\/table>/)?.[0];
  assert.ok(findingsTable);
  assert.equal((page.match(/<th scope="col"/g) || []).length, 4);
  assert.equal((findingsTable.match(/aria-sort=/g) || []).length, 1);
  assert.match(page, /<th scope="col" aria-sort="ascending"><button class="findings-sort" type="button" data-findings-sort="severity">P#/);
  assert.match(page, /data-findings-sort="id">F#/);
  assert.match(page, /data-findings-sort="status">Status/);
  assert.match(page, /data-findings-sort="title">Description/);
  assert.match(findingsTable, />↑1</);
  assert.match(findingsTable, />↑2</);
  assert.match(findingsTable, />↑3</);
  assert.match(findingsTable, />↕</);
  assert.match(page, /id="findings-sort-summary" aria-live="polite"/);
  assert.match(page, /id="findings-body"><tr><td class="findings-empty" colspan="4">/);
  assert.doesNotMatch(page, /id="findings-list"/);
  assert.match(page, /id="build-list" tabindex="0" aria-label="Build plan items"/);
  assert.match(page, /id="build-progressbar" role="progressbar"/);
  assert.match(page, /id="work-list" tabindex="0" aria-label="Current build steps"/);
  assert.match(page, /<article class="card current-work" id="current-work-card">/);
  assert.match(page, /id="history-list" tabindex="0" aria-label="Completed Blueprint work"/);
  assert.match(page, /class="status-rail"/);
  assert.doesNotMatch(page, /https:\/\//);
  assert.doesNotMatch(page, />Attention</);
  assert.match(page, /new EventSource\("\/api\/events"\)/);
  assert.match(page, /events\.addEventListener\("refresh", refresh\)/);
  assert.match(page, /setInterval\(refresh, 10000\)/);
  assert.match(page, /requestAnimationFrame\(\(\) => document\.body\.classList\.add\("hydrated"\)\)/);
  assert.match(page, /prefers-reduced-motion: reduce/);
  assert.match(page, /byId\("live-label"\)\.textContent = "Connected"/);
  assert.match(page, /healthCount === 1 \? " issue" : " issues"/);
  assert.match(page, /git\.changedFiles \+ " changed"/);
  assert.match(page, /buildSummary = "Current: " \+ currentBuildItem\.id/);
  assert.match(page, /work\.state === "active" && work\.buildPlanItem/);
  assert.match(page, /find\(\(item\) => !item\.checked && item\.id === work\.buildPlanItem\)/);
  assert.match(page, /const nextIndex = items\.findIndex\(\(item\) => !item\.checked\)/);
  assert.match(page, /const isNext = index === nextIndex && !isCurrent/);
  assert.match(page, /meta: isCurrent \? "current" : item\.checked \? "done" : isNext \? "next" : "planned"/);
  assert.match(page, /JSON\.stringify\(\[targetIndex, targetItem\.id \|\| null, targetItem\.title\]\)/);
  assert.match(page, /if \(targetKey === lastBuildPlanTargetKey\) return/);
  assert.match(page, /const targetCenter = targetBounds\.top - listBounds\.top \+ list\.scrollTop/);
  assert.match(page, /list\.scrollTop = Math\.max\(0, targetCenter - list\.clientHeight \/ 2\)/);
  assert.doesNotMatch(page, /scrollIntoView/);
  assert.match(page, /\{ key: "severity", direction: "ascending" \},\s+\{ key: "status", direction: "ascending" \},\s+\{ key: "id", direction: "ascending" \}/);
  assert.match(page, /const findingStatusOrder = \{ unverified: 0, open: 1, fixed: 2 \}/);
  assert.match(page, /new Intl\.Collator\(undefined, \{ numeric: true, sensitivity: "base" \}\)/);
  assert.match(page, /return left\.sourceIndex - right\.sourceIndex/);
  assert.match(page, /if \(index === 0\)[\s\S]+current\.direction = current\.direction === "ascending" \? "descending" : "ascending"/);
  assert.match(page, /else if \(index > 0\)[\s\S]+findingSortDescriptors\.unshift\(descriptor\)/);
  assert.match(page, /findingSortDescriptors\.unshift\(\{ key, direction: "ascending" \}\)/);
  assert.match(page, /renderFindings\(status\.findings\.active\)/);
  assert.match(page, /const body = byId\("findings-body"\);\s+body\.replaceChildren\(\)/);
  assert.doesNotMatch(page, /byId\("findings-table"\)\.replaceChildren/);
  assert.match(page, /cell\.colSpan = 4/);
  assert.match(page, /activity\.mode === "continuous"/);
  assert.match(page, /activity\.status === "running"/);
  assert.match(page, /\? "Current run"/);
  assert.match(page, /: "Last run"/);

  const elementIds = new Set(
    [...page.matchAll(/id="([^"]+)"/g)].map((match) => match[1])
  );
  const referencedIds = new Set(
    [...page.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1])
  );
  for (const id of referencedIds) {
    assert.ok(elementIds.has(id), `Dashboard script references missing element #${id}`);
  }

  const firstStatus = await readStatus(dashboard.url);
  assert.equal(firstStatus.project.name, "dashboard-project");
  assert.equal(firstStatus.configuration.state, "defaults");
  assert.equal(firstStatus.configuration.values.review.independentExecution, "automatic");
  assert.equal(
    firstStatus.configuration.values.qualityGates.regular.independentReview,
    "when-sensitive"
  );
  assert.equal(
    firstStatus.configuration.values.qualityGates.continuous.independentReview,
    "when-sensitive"
  );
  assert.equal(firstStatus.onboarding.state, "complete");
  assert.deepEqual(firstStatus.activity, {
    state: "recorded",
    mode: "autopilot",
    command: "autopilot",
    status: "ready",
    freshness: "current",
    summary: "Feature ready for review",
    detail: "Review the diff before completion.",
    boundary: "reviewed",
    startedAt: "2026-08-26T12:00:00.000Z",
    updatedAt: "2026-08-26T12:05:00.000Z",
    resumeCommand: null,
    progress: { current: 2, total: 2, label: "build steps" },
    feature: { id: "2", title: "Dashboard" }
  });
  assert.deepEqual(firstStatus.plans.build, {
    completed: 1,
    remaining: 1,
    total: 2,
    nextItem: { id: "2", title: "Dashboard" },
    splitParents: [],
    items: [
      { id: "1", title: "Foundation", checked: true },
      { id: "2", title: "Dashboard", checked: false }
    ]
  });
  assert.deepEqual(firstStatus.currentWork, {
    state: "active",
    type: "feature",
    title: "Dashboard",
    status: "in progress",
    buildPlanItem: "2",
    completed: 1,
    remaining: 1,
    total: 2,
    nextStep: { title: "Render live state" },
    steps: [
      { checked: true, title: "Read project status" },
      { checked: false, title: "Render live state" }
    ]
  });
  assert.equal(firstStatus.completion.state, "blocked");
  assert.deepEqual(firstStatus.nextAction, {
    command: "/implement",
    reason: "Resume with Render live state."
  });
  assert.deepEqual(firstStatus.history, {
    total: 1,
    items: [{
      type: "feature",
      title: "Foundation",
      buildPlanItem: "1",
      status: "complete"
    }]
  });

  await fs.writeFile(
    path.join(projectRoot, "blueprint", "build-plan.md"),
    `# Build Plan

- [x] 1. **Foundation** - establish the project
- [x] 2. **Dashboard** - show live project state
`
  );

  const updatedStatus = await readStatus(dashboard.url);
  assert.equal(updatedStatus.plans.build.completed, 2);
  assert.equal(updatedStatus.plans.build.remaining, 0);

  await fs.writeFile(
    path.join(projectRoot, "blueprint", "context", "current-feature.md"),
    `# Feature: Dashboard

**From build-plan:** feature 2
**Status:** implemented

## Build steps

- [x] **Step 1 - Read project status** - use the existing engine.
- [x] **Step 2 - Render live state** - update the browser.
`
  );

  const completedWorkStatus = await readStatus(dashboard.url);
  assert.equal(completedWorkStatus.currentWork.completed, 2);
  assert.equal(completedWorkStatus.currentWork.remaining, 0);
  assert.equal(completedWorkStatus.completion.state, "needs_verification");
  assert.equal(completedWorkStatus.nextAction.command, "/check");

  const workPath = path.join(projectRoot, "blueprint", "context", "current-feature.md");
  const work = await fs.readFile(workPath, "utf8");
  await fs.writeFile(workPath, work.replace("**Status:** implemented", "**Status:** verification failed"));
  const activityPath = path.join(projectRoot, "blueprint", ".state", "run.json");
  const activity = JSON.parse(await fs.readFile(activityPath, "utf8"));
  await fs.writeFile(activityPath, JSON.stringify({ ...activity, resumeCommand: "/complete current" }));

  const failedStatus = await readStatus(dashboard.url);
  assert.deepEqual(failedStatus.completion, { state: "blocked", blockers: ["verification failed"] });
  assert.equal(failedStatus.nextAction.command, "/implement");
  assert.match(failedStatus.nextAction.reason, /Verification failed/);
  assert.equal(failedStatus.activity.resumeCommand, "/complete current");
  const failedActivity = renderActivityPanel(page, failedStatus);
  assert.equal(failedActivity.get("activity-resume-row")?.hidden, true);
  assert.equal(failedActivity.get("activity-resume")?.textContent, "");

  await fs.writeFile(workPath, work.replace("**Status:** implemented", "**Status:** verified"));
  const reviewPath = path.join(projectRoot, "blueprint", "context", "review.md");
  await fs.writeFile(reviewPath, "# Independent Review\n\n**State:** passed\n");
  const malformedReviewStatus = await readStatus(dashboard.url);
  assert.equal(malformedReviewStatus.completion.state, "blocked");
  assert.equal(malformedReviewStatus.nextAction.command, "/blueprint-doctor");
  assert.match(malformedReviewStatus.nextAction.reason, /blueprint\/context\/review\.md/);
  await fs.rm(reviewPath);

  await fs.writeFile(
    path.join(projectRoot, "blueprint", "context", "findings.md"),
    "### F-01 [P1] unknown - Invalid status\n"
  );
  const malformedFindingsStatus = await readStatus(dashboard.url);
  assert.deepEqual(malformedFindingsStatus.completion, { state: "blocked", blockers: ["findings record is malformed"] });
  assert.equal(malformedFindingsStatus.nextAction.command, "/blueprint-doctor");
  assert.match(malformedFindingsStatus.nextAction.reason, /blueprint\/context\/findings\.md/);
  assert.equal(renderActivityPanel(page, malformedFindingsStatus).get("activity-resume-row")?.hidden, true);

  await fs.writeFile(
    path.join(projectRoot, "blueprint", "history", "features", "02-dashboard.md"),
    "# Feature: Dashboard\n\n**From build-plan:** feature 2\n**Status:** complete\n"
  );

  const historyStatus = await readStatus(dashboard.url);
  assert.equal(historyStatus.history.total, 2);
  assert.equal(historyStatus.history.items[0]?.title, "Dashboard");

  await fs.writeFile(
    path.join(projectRoot, "blueprint", "context", "current-feature.md"),
    `# Current Feature

_Nothing in progress. Run /feature to start._
`
  );

  const idleStatus = await readStatus(dashboard.url);
  assert.deepEqual(idleStatus.completion, { state: "idle", blockers: [] });
  assert.equal(idleStatus.nextAction.command, "/complete current");
  const idleActivity = renderActivityPanel(page, idleStatus);
  assert.equal(idleActivity.get("activity-resume-row")?.hidden, false);
  assert.equal(idleActivity.get("activity-resume")?.textContent, "/complete current");

  const postResponse = await fetch(`${dashboard.url}/api/status`, {
    method: "POST"
  });
  assert.equal(postResponse.status, 405);
  assert.equal(postResponse.headers.get("allow"), "GET, HEAD");

  const missingResponse = await fetch(`${dashboard.url}/source-file.ts`);
  assert.equal(missingResponse.status, 404);
});

test("dashboard closes its server cleanly", async (t) => {
  const projectRoot = await createProject(t);
  const dashboard = await startDashboardServer(projectRoot);
  await dashboard.close();

  await assert.rejects(fetch(`${dashboard.url}/api/status`));
});

test("dashboard emits an immediate refresh event when project state changes", async (t) => {
  const projectRoot = await createProject(t);
  const dashboard = await startDashboardServer(projectRoot);
  t.after(() => dashboard.close());
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`${dashboard.url}/api/events`, {
    signal: controller.signal
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/event-stream/);
  const reader = response.body?.getReader();
  assert.ok(reader);
  await reader.read();

  await fs.appendFile(
    path.join(projectRoot, "blueprint", ".state", "run.json"),
    "\n"
  );

  let timeout: NodeJS.Timeout | undefined;
  const event = await Promise.race([
    reader.read(),
    new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error("Dashboard refresh event timed out.")),
        1500
      );
    })
  ]).finally(() => clearTimeout(timeout));
  const payload = new TextDecoder().decode(event.value);

  assert.match(payload, /event: refresh/);
  await reader.cancel();
});

interface DashboardStatus {
  project: { name: string };
  onboarding: { state: string; reason: string | null };
  activity: {
    state: string;
    mode: string;
    command: string | null;
    status: string | null;
    freshness: string | null;
    summary: string | null;
    detail: string | null;
    boundary: string | null;
    startedAt: string | null;
    updatedAt: string | null;
    resumeCommand: string | null;
    progress: { current: number; total: number; label: string } | null;
    feature: { id: string | null; title: string } | null;
  };
  configuration: {
    state: string;
    values: {
      qualityGates: {
        regular: { audit: string; independentReview: string; check: string; tryGuide: string };
        continuous: { audit: string; independentReview: string; check: string; tryGuide: string };
      };
      review: { independentExecution: string };
    };
  };
  plans: {
    build: {
      completed: number;
      remaining: number;
      total: number;
      nextItem: { id: string | null; title: string } | null;
      splitParents: Array<{ id: string; title: string }>;
      items: Array<{ id: string | null; title: string; checked: boolean }>;
    };
  };
  currentWork: {
    state: string;
    type: string | null;
    title: string | null;
    status: string | null;
    buildPlanItem: string | null;
    completed: number;
    remaining: number;
    total: number;
    nextStep: { title: string } | null;
    steps: Array<{ checked: boolean; title: string }>;
  };
  history: {
    total: number;
    items: Array<{
      type: string;
      title: string;
      buildPlanItem: string | null;
      status: string | null;
    }>;
  };
  completion: {
    state: string;
    blockers: string[];
  };
  nextAction: {
    command: string | null;
    reason: string;
  };
}

function renderActivityPanel(page: string, status: DashboardStatus) {
  const script = [...page.matchAll(/<script>([\s\S]+?)<\/script>/g)].at(-1)?.[1];
  assert.ok(script);
  const elements = new Map<string, {
    hidden: boolean;
    textContent: string;
    className: string;
    title: string;
    setAttribute: (name: string, value: string) => void;
    addEventListener: () => void;
  }>();
  runInNewContext(`${script}\nrenderActivity(status.activity, status.configuration, status.nextAction);`, {
    status,
    document: {
      cookie: "",
      documentElement: { dataset: { theme: "light" } },
      hidden: true,
      getElementById(id: string) {
        if (!elements.has(id)) {
          elements.set(id, {
            hidden: false,
            textContent: "",
            className: "",
            title: "",
            setAttribute() {},
            addEventListener() {}
          });
        }
        return elements.get(id);
      },
      querySelectorAll: () => [],
      addEventListener() {}
    },
    EventSource: class { addEventListener() {} },
    setInterval() {}
  });
  return elements;
}

function resolveInitialTheme(page: string, cookie: string, systemDark: boolean): string | undefined {
  return loadInitialTheme(page, cookie, systemDark).theme;
}

function loadInitialTheme(page: string, cookie: string, systemDark: boolean) {
  const script = page.match(/<script>([\s\S]+?)<\/script>/)?.[1];
  assert.ok(script);
  const documentElement = { dataset: {} as Record<string, string> };
  let currentCookie = cookie;
  let renewedCookie: string | undefined;
  runInNewContext(script, {
    document: {
      get cookie() {
        return currentCookie;
      },
      set cookie(value: string) {
        renewedCookie = value;
        currentCookie = value;
      },
      documentElement
    },
    window: { matchMedia: () => ({ matches: systemDark }) }
  });
  return { theme: documentElement.dataset.theme, renewedCookie };
}

function toggleDashboardTheme(page: string, initialTheme: "dark" | "light") {
  const script = [...page.matchAll(/<script>([\s\S]+?)<\/script>/g)].at(-1)?.[1];
  assert.ok(script);
  const documentElement = { dataset: { theme: initialTheme } };
  const attributes = new Map<string, string>();
  let cookie = "";
  let clickListener: (() => void) | undefined;
  const elements = new Map<string, {
    hidden: boolean;
    textContent: string;
    className: string;
    title: string;
    setAttribute: (name: string, value: string) => void;
    addEventListener: (type: string, listener: () => void) => void;
  }>();
  const documentObject = {
    get cookie() {
      return cookie;
    },
    set cookie(value: string) {
      cookie = value;
    },
    documentElement,
    hidden: true,
    getElementById(id: string) {
      if (!elements.has(id)) {
        elements.set(id, {
          hidden: false,
          textContent: "",
          className: "",
          title: "",
          setAttribute(name, value) {
            if (id === "theme-toggle") attributes.set(name, value);
          },
          addEventListener(type, listener) {
            if (id === "theme-toggle" && type === "click") clickListener = listener;
          }
        });
      }
      return elements.get(id);
    },
    querySelectorAll: () => [],
    addEventListener() {}
  };

  runInNewContext(script, {
    document: documentObject,
    EventSource: class { addEventListener() {} },
    setInterval() {}
  });
  assert.ok(clickListener);
  clickListener();
  return {
    theme: documentElement.dataset.theme,
    cookie,
    label: attributes.get("aria-label"),
    title: elements.get("theme-toggle")?.title
  };
}

async function readStatus(url: string): Promise<DashboardStatus> {
  const response = await fetch(`${url}/api/status`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  return response.json() as Promise<DashboardStatus>;
}

async function createProject(t: TestContext): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-dashboard-"));
  const projectRoot = path.join(workspace, "dashboard-project");
  const contextRoot = path.join(projectRoot, "blueprint", "context");
  const stateRoot = path.join(projectRoot, "blueprint", ".state");
  const historyRoot = path.join(projectRoot, "blueprint", "history", "features");
  t.after(() => fs.rm(workspace, { recursive: true, force: true }));

  await fs.mkdir(contextRoot, { recursive: true });
  await fs.mkdir(stateRoot, { recursive: true });
  await fs.mkdir(historyRoot, { recursive: true });
  await fs.writeFile(path.join(projectRoot, "AGENTS.md"), "# Dashboard project\n");
  const projectPlan = "# Project Plan\n";
  const buildPlan = `# Build Plan

- [x] 1. **Foundation** - establish the project
- [ ] 2. **Dashboard** - show live project state
`;
  await fs.writeFile(
    path.join(projectRoot, "blueprint", "project-plan.md"),
    projectPlan
  );
  await fs.writeFile(
    path.join(projectRoot, "blueprint", "build-plan.md"),
    buildPlan
  );
  await fs.writeFile(
    path.join(contextRoot, "current-feature.md"),
    `# Feature: Dashboard

**From build-plan:** feature 2
**Status:** in progress

## Build steps

- [x] **Step 1 - Read project status** - use the existing engine.
- [ ] **Step 2 - Render live state** - update the browser.
`
  );
  await fs.writeFile(
    path.join(contextRoot, "findings.md"),
    "# Findings\n\n_No findings recorded._\n"
  );
  await fs.writeFile(
    path.join(stateRoot, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      version: "0.10.0",
      adapters: ["codex", "claude", "copilot", "opencode", "antigravity"],
      managedFiles: {}
    }, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(stateRoot, "run.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      command: "autopilot",
      status: "ready",
      summary: "Feature ready for review",
      detail: "Review the diff before completion.",
      boundary: "reviewed",
      startedAt: "2026-08-26T12:00:00.000Z",
      updatedAt: "2026-08-26T12:05:00.000Z",
      progress: { current: 2, total: 2, label: "build steps" },
      feature: { id: "2", title: "Dashboard" }
    }, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(historyRoot, "01-foundation.md"),
    "# Feature: Foundation\n\n**From build-plan:** feature 1\n**Status:** complete\n"
  );

  const planTime = new Date("2026-01-01T00:00:00Z");
  const overviewTime = new Date("2026-01-02T00:00:00Z");
  await fs.utimes(
    path.join(projectRoot, "blueprint", "project-plan.md"),
    planTime,
    planTime
  );
  await fs.utimes(
    path.join(projectRoot, "blueprint", "build-plan.md"),
    planTime,
    planTime
  );
  await fs.writeFile(
    path.join(contextRoot, "project-overview.md"),
    `# Project Overview

<!-- blueprint:source-hash ${createOverviewSourceHash(projectPlan, buildPlan)} -->
`
  );
  await fs.utimes(
    path.join(contextRoot, "project-overview.md"),
    overviewTime,
    overviewTime
  );

  await runGit(projectRoot, ["init", "-b", "feature/dashboard"]);
  await runGit(projectRoot, ["config", "user.email", "dashboard@example.com"]);
  await runGit(projectRoot, ["config", "user.name", "Dashboard Test"]);
  await runGit(projectRoot, ["add", "."]);
  await runGit(projectRoot, ["commit", "-m", "chore: create fixture"]);
  return projectRoot;
}

async function runGit(projectRoot: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8"
  });
}
