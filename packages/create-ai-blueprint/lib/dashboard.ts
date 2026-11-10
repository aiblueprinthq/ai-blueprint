import { spawn } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import http from "node:http";

import { readProjectStatus } from "./status.js";

interface DashboardServer {
  close: () => Promise<void>;
  url: string;
}

interface DashboardServerOptions {
  port?: number;
}

interface DashboardEvents {
  clients: Set<http.ServerResponse>;
}

const DASHBOARD_HOST = "127.0.0.1";

async function startDashboardServer(
  startPath: string = process.cwd(),
  options: DashboardServerOptions = {}
): Promise<DashboardServer> {
  const initialStatus = await readProjectStatus(startPath);
  const projectRoot = initialStatus.project.root;
  const events: DashboardEvents = { clients: new Set() };
  const server = http.createServer((request, response) => {
    void handleRequest(projectRoot, events, request, response);
  });
  let refreshTimer: NodeJS.Timeout | null = null;
  const watcher = createProjectWatcher(projectRoot, () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      broadcastRefresh(events);
    }, 60);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(options.port ?? 0, DASHBOARD_HOST);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Blueprint dashboard could not determine its local address.");
  }

  return {
    url: `http://${DASHBOARD_HOST}:${address.port}`,
    close: async () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      watcher?.close();
      for (const client of events.clients) {
        client.end();
      }
      events.clients.clear();
      await closeServer(server);
    }
  };
}

async function handleRequest(
  projectRoot: string,
  events: DashboardEvents,
  request: http.IncomingMessage,
  response: http.ServerResponse
): Promise<void> {
  const method = request.method || "GET";
  if (method !== "GET" && method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendResponse(response, method, 405, "text/plain; charset=utf-8", "Method not allowed.\n");
    return;
  }

  const pathname = new URL(request.url || "/", `http://${DASHBOARD_HOST}`).pathname;

  if (pathname === "/") {
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    );
    sendResponse(response, method, 200, "text/html; charset=utf-8", DASHBOARD_HTML);
    return;
  }

  if (pathname === "/api/status") {
    try {
      const status = await readProjectStatus(projectRoot);
      sendResponse(
        response,
        method,
        200,
        "application/json; charset=utf-8",
        `${JSON.stringify(status)}\n`
      );
    } catch (error: unknown) {
      sendResponse(
        response,
        method,
        500,
        "application/json; charset=utf-8",
        `${JSON.stringify({
          error: error instanceof Error ? error.message : "Unable to read Blueprint status."
        })}\n`
      );
    }
    return;
  }

  if (pathname === "/api/events") {
    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Content-Type-Options", "nosniff");

    if (method === "HEAD") {
      response.end();
      return;
    }

    events.clients.add(response);
    response.write(": connected\n\n");
    request.once("close", () => {
      events.clients.delete(response);
    });
    return;
  }

  if (pathname === "/favicon.ico") {
    sendResponse(response, method, 204, "text/plain; charset=utf-8", "");
    return;
  }

  sendResponse(response, method, 404, "text/plain; charset=utf-8", "Not found.\n");
}

function createProjectWatcher(
  projectRoot: string,
  onChange: () => void
): FSWatcher | null {
  try {
    const watcher = watch(
      projectRoot,
      { recursive: true },
      (_eventType, filename) => {
        const relativePath = filename?.toString().replaceAll("\\", "/") || "";
        if (
          relativePath.startsWith("node_modules/") ||
          relativePath.startsWith(".git/objects/")
        ) {
          return;
        }

        onChange();
      }
    );
    watcher.on("error", () => watcher.close());
    return watcher;
  } catch {
    return null;
  }
}

function broadcastRefresh(events: DashboardEvents): void {
  for (const client of events.clients) {
    if (client.destroyed || client.writableEnded) {
      events.clients.delete(client);
      continue;
    }

    client.write("event: refresh\ndata: changed\n\n");
  }
}

function sendResponse(
  response: http.ServerResponse,
  method: string,
  statusCode: number,
  contentType: string,
  body: string
): void {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", contentType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(method === "HEAD" ? undefined : body);
}

async function closeServer(server: http.Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function openDashboard(url: string): Promise<void> {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32"
    ? ["/c", "start", "", url]
    : [url];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

const DASHBOARD_HTML: string = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blueprint Dashboard</title>
  <script>
    (() => {
      const themeCookieName = "blueprint_dashboard_theme";
      const savedTheme = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith(themeCookieName + "="))
        ?.split("=")[1];
      const theme = savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      if (savedTheme === "dark" || savedTheme === "light") {
        document.cookie = themeCookieName + "=" + savedTheme + "; Max-Age=31536000; Path=/; SameSite=Lax";
      }
    })();
  </script>
  <style>
    :root {
      color-scheme: light;
      --font-sans: "Inter", "Helvetica Neue", Arial, sans-serif;
      --font-mono: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
      --paper: #f5f6f3;
      --paper-bright: #fbfcfa;
      --surface: rgba(255, 255, 255, .78);
      --surface-solid: #ffffff;
      --surface-muted: #eef1ed;
      --surface-glass: rgba(255, 255, 255, .82);
      --surface-soft: rgba(255, 255, 255, .68);
      --ink: #121817;
      --ink-soft: #45504d;
      --ink-muted: #65706d;
      --line: #d9ded9;
      --line-strong: #bdc7c1;
      --card-line: rgba(189, 199, 193, .78);
      --blue: #155eef;
      --blue-dark: #0b43ba;
      --blue-soft: #e9f0ff;
      --blue-line: #9bb8f4;
      --green: #0b7a53;
      --green-soft: #e7f5ee;
      --green-line: #b9dfce;
      --amber: #9a5700;
      --amber-soft: #fff2d9;
      --amber-line: #efd5a5;
      --red: #a5333f;
      --red-soft: #fdebed;
      --red-line: #efc2c7;
      --grid-line: rgba(21, 94, 239, .09);
      --grid-glow: rgba(21, 94, 239, .08);
      --run-surface: rgba(233, 240, 255, .88);
      --shadow-low: rgba(18, 24, 23, .05);
      --shadow-high: rgba(18, 24, 23, .12);
      --code: #111715;
      --code-raised: #171e1c;
      --code-line: #2c3532;
      --code-text: #d9dfdc;
      --code-muted: #9ba7a2;
      --code-blue: #76a8ff;
      --code-green: #70d5a9;
      font-family: var(--font-sans);
      background: var(--paper);
      color: var(--ink);
    }

    :root[data-theme="dark"] {
      color-scheme: dark;
      --paper: #0d1211;
      --paper-bright: #121817;
      --surface: rgba(23, 30, 28, .84);
      --surface-solid: #171e1c;
      --surface-muted: #202825;
      --surface-glass: rgba(23, 30, 28, .9);
      --surface-soft: rgba(23, 30, 28, .72);
      --ink: #eef3f0;
      --ink-soft: #c4ccc8;
      --ink-muted: #939f99;
      --line: #313b37;
      --line-strong: #47544e;
      --card-line: rgba(71, 84, 78, .78);
      --blue: #76a8ff;
      --blue-dark: #9abcff;
      --blue-soft: #172b50;
      --blue-line: #365b9c;
      --green: #70d5a9;
      --green-soft: #173c30;
      --green-line: #285f4b;
      --amber: #e8bd72;
      --amber-soft: #332919;
      --amber-line: #6a5029;
      --red: #ef9aa4;
      --red-soft: #321c20;
      --red-line: #6a3339;
      --grid-line: rgba(118, 168, 255, .07);
      --grid-glow: rgba(118, 168, 255, .09);
      --run-surface: rgba(23, 43, 80, .72);
      --shadow-low: rgba(0, 0, 0, .2);
      --shadow-high: rgba(0, 0, 0, .28);
      --code: #090d0c;
      --code-raised: #121816;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-width: 320px;
      min-height: 100vh;
      background:
        linear-gradient(var(--grid-line) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
        radial-gradient(circle at 12% 0%, var(--grid-glow), transparent 34rem),
        var(--paper);
      background-size: 40px 40px, 40px 40px, auto, auto;
      -webkit-font-smoothing: antialiased;
    }

    ::selection { color: #fff; background: var(--blue); }

    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 38px 0 64px; }

    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 30px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 11px;
      margin-bottom: 28px;
      color: var(--ink);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -.02em;
    }

    .brand-mark { width: 28px; height: 28px; flex: 0 0 auto; }
    .brand-mark path { fill: var(--blue); }
    .brand-context { color: var(--ink-muted); font-family: var(--font-mono); font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; }
    .brand-separator { width: 1px; height: 17px; background: var(--line-strong); }
    .theme-toggle { display: inline-grid; width: 34px; height: 34px; padding: 0; place-items: center; border: 1px solid var(--line-strong); border-radius: 10px; background: var(--surface-glass); color: var(--ink-soft); cursor: pointer; }
    .theme-toggle:hover { border-color: var(--blue); color: var(--ink); }
    .theme-toggle:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
    .theme-toggle svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .theme-icon-sun { display: none; }
    :root[data-theme="dark"] .theme-icon-moon { display: none; }
    :root[data-theme="dark"] .theme-icon-sun { display: block; }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--blue-dark);
      font: 600 11px/1 var(--font-mono);
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .eyebrow::before { width: 22px; height: 1px; content: ""; background: var(--blue); }

    h1 { margin: 13px 0 8px; color: var(--ink); font-size: clamp(32px, 4vw, 50px); letter-spacing: -.045em; }
    .path { max-width: 760px; overflow-wrap: anywhere; color: var(--ink-muted); font: 12px/1.6 var(--font-mono); }
    .header-actions { display: flex; align-items: center; gap: 10px; }

    .live {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      background: var(--surface-glass);
      color: var(--ink-soft);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 1px 2px var(--shadow-low);
    }

    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px rgba(11, 122, 83, .1); }
    .live.offline .live-dot { background: var(--red); box-shadow: 0 0 0 4px rgba(165, 51, 63, .1); }

    .card { min-width: 0; padding: 22px; border: 1px solid var(--card-line); border-radius: 14px; background: var(--surface); box-shadow: 0 1px 2px var(--shadow-low), 0 10px 30px var(--shadow-low); backdrop-filter: blur(14px); }

    .card-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .label { margin: 0; color: var(--blue-dark); font: 600 11px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
    .value { color: var(--ink); font-size: 20px; font-weight: 700; letter-spacing: -.02em; }
    .muted { color: var(--ink-muted); font-size: 13px; line-height: 1.6; }

    .pill { padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; color: var(--ink-muted); background: var(--surface-muted); font: 600 10px/1 var(--font-mono); letter-spacing: .04em; text-transform: uppercase; }
    .pill.ok, .pill.ready, .pill.active { border-color: var(--green-line); background: var(--green-soft); color: var(--green); }
    .pill.warning, .pill.blocked, .pill.needs_verification { border-color: var(--amber-line); background: var(--amber-soft); color: var(--amber); }
    .pill.malformed, .pill.unavailable { border-color: var(--red-line); background: var(--red-soft); color: var(--red); }

    .facts { display: grid; gap: 12px; }
    .fact { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; padding-bottom: 11px; border-bottom: 1px solid var(--line); }
    .fact:last-child { padding-bottom: 0; border-bottom: 0; }
    .fact span:first-child { color: var(--ink-muted); font-size: 12px; }
    .fact span:last-child { max-width: 70%; overflow-wrap: anywhere; color: var(--ink-soft); font: 12px/1.45 var(--font-mono); text-align: right; }

    .health-summary { margin-top: 20px; padding: 13px 15px; border: 1px solid var(--amber-line); border-radius: 10px; background: var(--amber-soft); }
    .health-summary.clear { border-color: var(--green-line); background: var(--green-soft); }
    .health-summary .summary-label { color: var(--amber); font: 600 10px/1 var(--font-mono); letter-spacing: .06em; text-transform: uppercase; }
    .health-summary.clear .summary-label { color: var(--green); }
    .health-summary li { padding: 8px 0 0; border: 0; color: var(--ink-soft); font-size: 12px; }

    .progress { height: 8px; margin: 16px 0 10px; overflow: hidden; border-radius: 999px; background: var(--surface-muted); }
    .progress span { display: block; width: 0; height: 100%; border-radius: inherit; background: var(--blue); }
    body.hydrated .progress span { transition: width .25s ease; }

    .code-panel { color: var(--code-text); border-color: var(--code-line); background: var(--code); box-shadow: 0 24px 80px var(--shadow-high); backdrop-filter: none; }
    .code-panel .label { color: var(--code-blue); }
    .code-panel .value { color: #fff; }
    .code-panel .muted { color: var(--code-muted); }
    .code-panel .fact { border-color: var(--code-line); }
    .code-panel .fact span:first-child { color: var(--code-muted); }
    .code-panel .fact span:last-child { color: var(--code-text); }
    .code-panel .pill { border-color: #35403d; background: var(--code-raised); color: var(--code-muted); }
    .code-panel .pill.active, .code-panel .pill.ready, .code-panel .pill.ok { border-color: #285f4b; background: #173c30; color: var(--code-green); }
    .code-panel .pill.warning, .code-panel .pill.blocked, .code-panel .pill.needs_verification { border-color: #6a5029; background: #332919; color: #e8bd72; }
    .code-panel .pill.malformed, .code-panel .pill.unavailable { border-color: #6a3339; background: #321c20; color: #ef9aa4; }

    .next-action { padding: 24px; }
    .command { margin: 13px 0 8px; color: var(--code-blue); font: 600 clamp(20px, 3vw, 29px)/1.3 var(--font-mono); overflow-wrap: anywhere; }

    ul { margin: 0; padding: 0; list-style: none; }
    li { padding: 11px 0; border-bottom: 1px solid var(--line); color: var(--ink-soft); font-size: 13px; line-height: 1.5; }
    li:last-child { border-bottom: 0; }
    .timeline { max-height: 280px; margin-top: 14px; padding-right: 8px; overflow-y: auto; }
    .timeline-item { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; align-items: baseline; gap: 10px; }
    .timeline-mark { color: var(--ink-muted); font: 600 12px/1 var(--font-mono); }
    .timeline-item.done .timeline-mark { color: var(--green); }
    .timeline-item.current { color: var(--ink); font-weight: 600; }
    .timeline-item.current .timeline-mark { color: var(--blue); }
    .timeline-meta { color: var(--ink-muted); font: 10px/1.4 var(--font-mono); text-transform: uppercase; }
    .timeline-title { min-width: 0; overflow-wrap: anywhere; }
    .empty { color: var(--ink-muted); }
    .error { color: var(--red); }

    .next-action {
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 16px;
      border: 1px solid var(--code-line);
      border-radius: 15px;
    }

    .next-action-main { min-width: 0; }
    .next-action-state { display: grid; min-width: 180px; align-content: center; padding-left: 24px; border-left: 1px solid var(--code-line); }
    .next-action-state span { color: var(--code-muted); font: 600 9px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
    .next-action-state strong { margin-top: 8px; color: var(--code-green); font: 600 11px/1.3 var(--font-mono); text-transform: uppercase; }
    .next-action-state strong.blocked { color: #ef9aa4; }
    .next-action-state strong.needs_verification { color: #e8bd72; }

    .run-context {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(330px, .72fr);
      gap: 24px;
      margin-bottom: 16px;
      padding: 19px 22px;
      border: 1px solid var(--blue-line);
      border-radius: 14px;
      background: var(--run-surface);
      box-shadow: 0 1px 2px var(--shadow-low);
    }

    .run-context[hidden] { display: none; }
    .run-command { margin: 8px 0 5px; color: var(--blue-dark); font: 700 21px/1.2 var(--font-mono); }
    .run-summary { color: var(--ink); font-size: 13px; font-weight: 650; line-height: 1.45; }
    .run-main .muted { margin-top: 4px; }
    .run-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; align-content: center; }
    .run-meta .pill { width: fit-content; }
    .run-meta div { display: grid; gap: 4px; }
    .run-meta div span { color: var(--ink-muted); font: 600 8px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
    .run-meta div strong { overflow-wrap: anywhere; color: var(--ink-soft); font: 600 10px/1.4 var(--font-mono); }
    .pill.running, .pill.completed { border-color: var(--green-line); background: var(--green-soft); color: var(--green); }

    .dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.85fr) minmax(285px, .75fr); gap: 16px; align-items: start; }
    .main-column, .status-rail { display: grid; gap: 16px; }
    .dashboard-grid .card { grid-column: auto; }
    .section-title { margin-top: 8px; color: var(--ink); font-size: 18px; font-weight: 700; letter-spacing: -.025em; }

    .work-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
    .work-kicker { color: var(--blue); font: 600 10px/1 var(--font-mono); letter-spacing: .08em; text-transform: uppercase; }
    .work-title { margin: 7px 0 6px; color: var(--ink); font-size: clamp(23px, 3vw, 31px); font-weight: 700; line-height: 1.08; letter-spacing: -.04em; }
    .work-count { padding: 6px 9px; border-radius: 7px; background: var(--blue-soft); color: var(--blue-dark); font: 600 10px/1 var(--font-mono); white-space: nowrap; }
    .work-progress { height: 7px; margin: 18px 0 14px; overflow: hidden; border-radius: 999px; background: var(--surface-muted); }
    .work-progress span { display: block; width: 0; height: 100%; border-radius: inherit; background: var(--blue); }
    body.hydrated .work-progress span { transition: width .25s ease; }
    .work-steps { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .work-steps li { min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface-soft); }
    .work-steps .timeline-item { grid-template-columns: 18px minmax(0, 1fr); align-items: start; gap: 8px; }
    .work-steps .timeline-meta { grid-column: 2; margin-top: 2px; }
    .work-steps .timeline-item.done { border-color: var(--green-line); background: var(--green-soft); }
    .work-steps .timeline-item.current { border-color: var(--blue-line); background: var(--blue-soft); box-shadow: inset 3px 0 0 var(--blue); }
    .current-work.idle .work-title { font-size: 22px; }
    .current-work.idle .work-progress { display: none; }
    .current-work.idle .work-steps { grid-template-columns: 1fr; margin-top: 12px; }

    .build-plan-card .timeline { max-height: 250px; }
    .build-plan-card .timeline-item.done { opacity: .58; }
    .build-plan-card .timeline-item.current { opacity: 1; }
    .history-card .timeline { max-height: 190px; }

    .project-state-card .card-head, .findings-card .card-head, .completion-card .card-head { margin-bottom: 14px; }
    .fact-group { margin-top: 17px; padding-top: 16px; border-top: 1px solid var(--line); }
    .fact-group-label { margin-bottom: 10px; color: var(--ink-muted); font: 600 9px/1 var(--font-mono); letter-spacing: .1em; text-transform: uppercase; }
    .fact-group-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .fact-group-heading .fact-group-label { margin-bottom: 0; }
    .fact.stacked { align-items: flex-start; flex-direction: column; gap: 5px; }
    .fact.stacked span:last-child { max-width: 100%; text-align: left; }
    .status-rail .health-summary { margin-top: 0; }
    .status-rail .value { font-size: 15px; }
    .findings-table-wrap { max-width: 100%; overflow-x: auto; }
    .findings-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .findings-table th, .findings-table td { padding: 8px 4px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    .findings-table th:first-child, .findings-table td:first-child { width: 38px; }
    .findings-table th:nth-child(2), .findings-table td:nth-child(2) { width: 34px; }
    .findings-table th:nth-child(3), .findings-table td:nth-child(3) { width: 68px; }
    .findings-table th { color: var(--ink-muted); font: 600 9px/1 var(--font-mono); }
    .findings-table td { color: var(--ink-soft); font-size: 10px; line-height: 1.4; }
    .findings-table tbody tr:last-child td { border-bottom: 0; }
    .findings-table .finding-description { overflow-wrap: anywhere; }
    .findings-table .finding-status { text-transform: capitalize; }
    .findings-sort { display: inline-flex; align-items: center; gap: 3px; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-transform: uppercase; cursor: pointer; }
    .findings-sort:hover, .findings-sort:focus-visible { color: var(--blue-dark); }
    .findings-sort:focus-visible { outline: 2px solid var(--blue); outline-offset: 3px; }
    .findings-sort-indicator { color: var(--blue-dark); white-space: nowrap; }
    .findings-empty { color: var(--ink-muted); text-align: center; }
    .findings-sort-summary { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    .completion-card li { font-size: 11px; }

    footer { margin-top: 18px; color: var(--ink-muted); font: 11px/1.6 var(--font-mono); text-align: center; }

    @media (max-width: 900px) {
      .dashboard-grid { grid-template-columns: 1fr; }
      .status-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .project-state-card { grid-row: span 2; }
      .run-context { grid-template-columns: 1fr; }
    }

    @media (max-width: 620px) {
      .shell { width: min(100% - 24px, 1180px); padding-top: 24px; }
      header { flex-direction: column; }
      .brand { margin-bottom: 22px; }
      .next-action { flex-direction: column; }
      .next-action-state { min-width: 0; padding: 14px 0 0; border-top: 1px solid var(--code-line); border-left: 0; }
      .run-meta, .status-rail, .work-steps { grid-template-columns: 1fr; }
      .work-title-row { flex-direction: column; }
    }

    @media (prefers-reduced-motion: reduce) {
      body.hydrated .progress span, body.hydrated .work-progress span { transition: none; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 4h25.2L16.3 44H4zM39.7 4H44v40H26.8z"></path>
      </svg>
      <span>AI Blueprint</span>
      <span class="brand-separator" aria-hidden="true"></span>
      <span class="brand-context">Dashboard</span>
    </div>
    <header>
      <div>
        <div class="eyebrow">Local project status</div>
        <h1 id="project-name">Loading project...</h1>
        <div class="path" id="project-path"></div>
      </div>
      <div class="header-actions">
        <div class="live" id="live-state" aria-live="polite"><span class="live-dot"></span><span id="live-label">Connecting</span></div>
        <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Use dark theme" title="Use dark theme">
          <svg class="theme-icon-moon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.2 10.3A5.8 5.8 0 0 1 5.7 2.8 5.3 5.3 0 1 0 13.2 10.3Z"></path>
          </svg>
          <svg class="theme-icon-sun" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="2.5"></circle>
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1"></path>
          </svg>
        </button>
      </div>
    </header>

    <section class="code-panel next-action" aria-labelledby="next-action-label">
      <div class="next-action-main">
        <h2 class="label" id="next-action-label">Next action</h2>
        <div class="command" id="next-command" aria-live="polite">Loading...</div>
        <div class="muted" id="next-reason"></div>
      </div>
      <div class="next-action-state">
        <span>Completion gate</span>
        <strong id="next-state-label">Checking</strong>
      </div>
    </section>

    <section class="run-context" id="activity-panel" aria-labelledby="activity-label" hidden>
      <div class="run-main">
        <div class="label" id="activity-label">Run context</div>
        <div class="run-command" id="activity-command">-</div>
        <div class="run-summary" id="activity-summary"></div>
        <div class="muted" id="activity-detail"></div>
      </div>
      <div class="run-meta">
        <span class="pill" id="activity-status">-</span>
        <div><span>Mode</span><strong id="activity-mode">-</strong></div>
        <div><span>Boundary</span><strong id="activity-boundary">-</strong></div>
        <div><span>Gates</span><strong id="activity-gates">-</strong></div>
        <div id="activity-progress-row" hidden><span>Progress</span><strong id="activity-progress">-</strong></div>
        <div id="activity-resume-row" hidden><span>Resume</span><strong id="activity-resume">-</strong></div>
      </div>
    </section>

    <section class="dashboard-grid" aria-label="Blueprint project status">
      <div class="main-column">
        <article class="card current-work" id="current-work-card">
          <div class="card-head"><h2 class="label">Current work</h2><span class="pill" id="work-state">Loading</span></div>
          <div class="work-title-row">
            <div>
              <div class="work-kicker" id="work-kicker">ACTIVE WORK</div>
              <div class="work-title" id="work-title">-</div>
            </div>
            <div class="work-count" id="work-count">-</div>
          </div>
          <div class="muted" id="work-meta"></div>
          <div class="work-progress" id="work-progressbar" role="progressbar" aria-label="Current work completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="work-progress"></span></div>
          <ul class="work-steps" id="work-list" tabindex="0" aria-label="Current build steps"><li class="empty">Loading build steps...</li></ul>
        </article>

        <article class="card build-plan-card">
          <div class="card-head"><div><h2 class="label">Build plan</h2><div class="section-title">Roadmap</div></div><span class="value" id="build-count">-</span></div>
          <div class="progress" id="build-progressbar" role="progressbar" aria-label="Build plan completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="build-progress"></span></div>
          <div class="muted" id="build-next">Reading the plan...</div>
          <ul class="timeline" id="build-list" tabindex="0" aria-label="Build plan items"><li class="empty">Loading the roadmap...</li></ul>
        </article>

        <article class="card history-card">
          <div class="card-head"><div><h2 class="label">Completed work</h2><div class="muted">Archived features and fixes</div></div><span class="value" id="history-count">-</span></div>
          <ul class="timeline" id="history-list" tabindex="0" aria-label="Completed Blueprint work"><li class="empty">Loading completed work...</li></ul>
        </article>
      </div>

      <aside class="status-rail" aria-label="Project state">
        <article class="card project-state-card">
          <div class="card-head"><h2 class="section-title">Project state</h2><span class="pill" id="health">Loading</span></div>
          <div class="health-summary" id="health-summary">
            <span class="summary-label" id="health-summary-label">Checking</span>
            <ul id="health-list" aria-live="polite"><li class="empty">Reading workflow state...</li></ul>
          </div>
          <div class="fact-group">
            <div class="fact-group-label">Blueprint</div>
            <div class="facts">
              <div class="fact"><span>Version</span><span id="version">-</span></div>
              <div class="fact"><span>Adapters</span><span id="adapters">-</span></div>
              <div class="fact"><span>Config</span><span id="config">-</span></div>
              <div class="fact"><span>Review execution</span><span id="review-execution">-</span></div>
              <div class="fact"><span>Onboarding</span><span id="onboarding">-</span></div>
              <div class="fact"><span>Overview</span><span id="overview">-</span></div>
            </div>
          </div>
          <div class="fact-group">
            <div class="fact-group-heading"><div class="fact-group-label">Git</div><span class="pill" id="git-state">Loading</span></div>
            <div class="facts">
              <div class="fact"><span>Branch</span><span id="git-branch">-</span></div>
              <div class="fact"><span>Changed</span><span id="git-changed">-</span></div>
              <div class="fact"><span>Upstream</span><span id="git-upstream">-</span></div>
            </div>
          </div>
          <div class="fact-group">
            <div class="fact-group-label">Quality gates</div>
            <div class="facts">
              <div class="fact stacked"><span>Regular</span><span id="regular-gates">-</span></div>
              <div class="fact stacked"><span>Continuous</span><span id="continuous-gates">-</span></div>
            </div>
          </div>
        </article>

        <article class="card findings-card">
          <div class="card-head"><h2 class="section-title">Findings</h2><span class="value" id="findings-count">-</span></div>
          <div class="findings-table-wrap">
            <table class="findings-table">
              <caption class="findings-sort-summary">Active findings</caption>
              <thead>
                <tr>
                  <th scope="col"><button class="findings-sort" type="button" data-findings-sort="id">F# <span class="findings-sort-indicator" aria-hidden="true">↑3</span></button></th>
                  <th scope="col" aria-sort="ascending"><button class="findings-sort" type="button" data-findings-sort="severity">P# <span class="findings-sort-indicator" aria-hidden="true">↑1</span></button></th>
                  <th scope="col"><button class="findings-sort" type="button" data-findings-sort="status">Status <span class="findings-sort-indicator" aria-hidden="true">↑2</span></button></th>
                  <th scope="col"><button class="findings-sort" type="button" data-findings-sort="title">Description <span class="findings-sort-indicator" aria-hidden="true">↕</span></button></th>
                </tr>
              </thead>
              <tbody id="findings-body"><tr><td class="findings-empty" colspan="4">Loading findings...</td></tr></tbody>
            </table>
          </div>
          <p class="findings-sort-summary" id="findings-sort-summary" aria-live="polite">Sorted by P# ascending, Status ascending, then F# ascending.</p>
        </article>

        <article class="card completion-card">
          <div class="card-head"><h2 class="section-title">Completion</h2><span class="pill" id="completion-state">Loading</span></div>
          <ul id="completion-list"><li class="empty">Checking readiness...</li></ul>
        </article>
      </aside>
    </section>

    <footer>Read-only local dashboard. Updates as Blueprint and project files change.</footer>
  </main>

  <script>
    const byId = (id) => document.getElementById(id);
    const themeToggle = byId("theme-toggle");
    const themeCookieName = "blueprint_dashboard_theme";

    function syncThemeToggle() {
      const dark = document.documentElement.dataset.theme === "dark";
      const label = dark ? "Use light theme" : "Use dark theme";
      themeToggle.setAttribute("aria-label", label);
      themeToggle.title = label;
    }

    function toggleTheme() {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = theme;
      document.cookie = themeCookieName + "=" + theme + "; Max-Age=31536000; Path=/; SameSite=Lax";
      syncThemeToggle();
    }

    themeToggle.addEventListener("click", toggleTheme);
    syncThemeToggle();

    const findingIdCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    const findingSeverityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const findingStatusOrder = { unverified: 0, open: 1, fixed: 2 };
    const findingSortLabels = { id: "F#", severity: "P#", status: "Status", title: "Description" };
    let activeFindings = [];
    let findingSortDescriptors = [
      { key: "severity", direction: "ascending" },
      { key: "status", direction: "ascending" },
      { key: "id", direction: "ascending" }
    ];
    let lastPayload = "";
    let lastBuildPlanTargetKey;
    let refreshing = false;

    function setPill(id, value, label = value) {
      const node = byId(id);
      node.textContent = String(label).replaceAll("_", " ");
      node.className = "pill " + value;
    }

    function setList(id, values, emptyMessage) {
      const list = byId(id);
      list.replaceChildren();
      const items = values.length > 0 ? values : [emptyMessage];
      for (const value of items) {
        const item = document.createElement("li");
        item.textContent = value;
        if (values.length === 0) item.className = "empty";
        list.append(item);
      }
    }

    function compareFindingValues(left, right, key) {
      if (key === "severity") {
        return (findingSeverityOrder[left.severity] ?? 4) -
          (findingSeverityOrder[right.severity] ?? 4);
      }
      if (key === "status") {
        return (findingStatusOrder[left.status] ?? 3) -
          (findingStatusOrder[right.status] ?? 3);
      }
      if (key === "id") return findingIdCollator.compare(left.id, right.id);
      return findingIdCollator.compare(left.title, right.title);
    }

    function sortFindings(findings) {
      return [...findings]
        .map((finding, sourceIndex) => ({ finding, sourceIndex }))
        .sort((left, right) => {
          for (const descriptor of findingSortDescriptors) {
            const comparison = compareFindingValues(left.finding, right.finding, descriptor.key);
            if (comparison !== 0) {
              return descriptor.direction === "ascending" ? comparison : -comparison;
            }
          }
          return left.sourceIndex - right.sourceIndex;
        })
        .map((entry) => entry.finding);
    }

    function updateFindingsSortControls() {
      const buttons = document.querySelectorAll("[data-findings-sort]");
      for (const button of buttons) {
        const key = button.dataset.findingsSort;
        const index = findingSortDescriptors.findIndex((descriptor) => descriptor.key === key);
        const indicator = button.querySelector(".findings-sort-indicator");
        const header = button.closest("th");
        header.removeAttribute("aria-sort");
        if (index < 0) {
          indicator.textContent = "↕";
          continue;
        }

        const descriptor = findingSortDescriptors[index];
        indicator.textContent = (descriptor.direction === "ascending" ? "↑" : "↓") +
          String(index + 1);
        if (index === 0) header.setAttribute("aria-sort", descriptor.direction);
      }

      byId("findings-sort-summary").textContent = "Sorted by " +
        findingSortDescriptors.map((descriptor, index) =>
          findingSortLabels[descriptor.key] + " " + descriptor.direction +
          " priority " + String(index + 1)
        ).join(", then ") + ".";
    }

    function renderFindings(findings) {
      activeFindings = [...findings];
      const body = byId("findings-body");
      body.replaceChildren();
      const sortedFindings = sortFindings(activeFindings);

      if (sortedFindings.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.className = "findings-empty";
        cell.colSpan = 4;
        cell.textContent = "No active findings.";
        row.append(cell);
        body.append(row);
        updateFindingsSortControls();
        return;
      }

      for (const finding of sortedFindings) {
        const row = document.createElement("tr");
        const values = [finding.id, finding.severity, finding.status, finding.title];
        values.forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 2) cell.className = "finding-status";
          if (index === 3) cell.className = "finding-description";
          row.append(cell);
        });
        body.append(row);
      }
      updateFindingsSortControls();
    }

    function promoteFindingsSort(key) {
      const index = findingSortDescriptors.findIndex((descriptor) => descriptor.key === key);
      if (index === 0) {
        const current = findingSortDescriptors[0];
        current.direction = current.direction === "ascending" ? "descending" : "ascending";
      } else if (index > 0) {
        const [descriptor] = findingSortDescriptors.splice(index, 1);
        findingSortDescriptors.unshift(descriptor);
      } else {
        findingSortDescriptors.unshift({ key, direction: "ascending" });
      }
      renderFindings(activeFindings);
    }

    function addTimelineItem(list, options) {
      const item = document.createElement("li");
      item.className = "timeline-item" + (options.className ? " " + options.className : "");

      const mark = document.createElement("span");
      mark.className = "timeline-mark";
      mark.textContent = options.mark;

      const title = document.createElement("span");
      title.className = "timeline-title";
      title.textContent = options.title;

      const meta = document.createElement("span");
      meta.className = "timeline-meta";
      meta.textContent = options.meta;

      item.append(mark, title, meta);
      list.append(item);
      return item;
    }

    function centerBuildPlanTarget(list, target, targetKey) {
      if (targetKey === lastBuildPlanTargetKey) return;
      lastBuildPlanTargetKey = targetKey;
      if (!target) return;

      const listBounds = list.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      const targetCenter = targetBounds.top - listBounds.top + list.scrollTop +
        targetBounds.height / 2;
      list.scrollTop = Math.max(0, targetCenter - list.clientHeight / 2);
    }

    function setBuildPlan(items, currentId) {
      const list = byId("build-list");
      list.replaceChildren();

      if (items.length === 0) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "No build-plan items are available.";
        list.append(item);
        centerBuildPlanTarget(list, null, null);
        return;
      }

      const nextIndex = items.findIndex((item) => !item.checked);
      const currentIndex = currentId
        ? items.findIndex((item) => !item.checked && item.id === currentId)
        : -1;
      const targetIndex = currentIndex >= 0 ? currentIndex : nextIndex;
      const targetItem = targetIndex >= 0 ? items[targetIndex] : null;
      const targetKey = targetItem
        ? JSON.stringify([targetIndex, targetItem.id || null, targetItem.title])
        : null;
      let target = null;
      items.forEach((item, index) => {
        const isCurrent = index === currentIndex;
        const isNext = index === nextIndex && !isCurrent;
        const node = addTimelineItem(list, {
          mark: item.checked ? "✓" : isCurrent ? "›" : "○",
          title: (item.id ? item.id + " - " : "") + item.title,
          meta: isCurrent ? "current" : item.checked ? "done" : isNext ? "next" : "planned",
          className: item.checked ? "done" : isCurrent ? "current" : ""
        });
        if (index === targetIndex) target = node;
      });

      centerBuildPlanTarget(list, target, target ? targetKey : null);
    }

    function setWorkSteps(work) {
      const list = byId("work-list");
      list.replaceChildren();

      if (work.steps.length === 0) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = work.state === "idle" ? "No feature is active." : "No valid build steps were found.";
        list.append(item);
        return;
      }

      const nextIndex = work.steps.findIndex((step) => !step.checked);
      work.steps.forEach((step, index) => {
        addTimelineItem(list, {
          mark: step.checked ? "✓" : index === nextIndex ? "›" : "○",
          title: step.title,
          meta: step.checked ? "done" : index === nextIndex ? "next" : "waiting",
          className: step.checked ? "done" : index === nextIndex ? "current" : ""
        });
      });
    }

    function setHistory(history) {
      const list = byId("history-list");
      list.replaceChildren();
      byId("history-count").textContent = String(history.total);

      if (history.items.length === 0) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "No completed work has been archived yet.";
        list.append(item);
        return;
      }

      for (const item of history.items) {
        addTimelineItem(list, {
          mark: "✓",
          title: (item.buildPlanItem ? item.buildPlanItem + " - " : "") + item.title,
          meta: item.type,
          className: "done"
        });
      }
    }

    function formatGates(gates) {
      return "audit " + gates.audit + ", independent review " + gates.independentReview +
        ", check " + gates.check +
        ", try guide " + gates.tryGuide +
        ", spec check " + gates.specCheck;
    }

    function renderActivity(activity, configuration, nextAction) {
      const panel = byId("activity-panel");
      if (activity.state !== "recorded") {
        panel.hidden = true;
        return;
      }

      panel.hidden = false;
      byId("activity-label").textContent = activity.freshness === "stale" ||
          activity.status === "blocked"
        ? "Interrupted run"
        : activity.status === "running"
          ? "Current run"
          : activity.status === "ready"
            ? "Review handoff"
            : "Last run";
      byId("activity-command").textContent = "/" + activity.command;
      byId("activity-summary").textContent = activity.summary;
      byId("activity-detail").textContent = activity.detail ||
        (activity.feature
          ? (activity.feature.id ? activity.feature.id + " - " : "") + activity.feature.title
          : "");
      setPill(
        "activity-status",
        activity.freshness === "stale" ? "blocked" : activity.status,
        activity.freshness === "stale" ? "interrupted" : activity.status
      );
      byId("activity-mode").textContent = activity.mode;
      byId("activity-boundary").textContent = activity.boundary || "not recorded";
      const gates = activity.mode === "continuous"
        ? configuration.values.qualityGates.continuous
        : configuration.values.qualityGates.regular;
      byId("activity-gates").textContent = formatGates(gates);

      const progressRow = byId("activity-progress-row");
      progressRow.hidden = !activity.progress;
      if (activity.progress) {
        byId("activity-progress").textContent = activity.progress.current + "/" +
          activity.progress.total + " " + activity.progress.label;
      }

      const resumeRow = byId("activity-resume-row");
      resumeRow.hidden = !activity.resumeCommand || activity.resumeCommand !== nextAction.command;
      byId("activity-resume").textContent = resumeRow.hidden ? "" : activity.resumeCommand;
    }

    function render(status) {
      byId("project-name").textContent = status.project.name;
      byId("project-path").textContent = status.project.root;
      const healthIssues = status.warnings.map((warning) => warning.message).concat(
        status.findings.blockers.map((finding) => "Blocking finding " + finding.id + ": " + finding.title),
        status.completion.blockers.filter((blocker) =>
          blocker.includes("independent review") || blocker === "verification failed")
      );
      const healthCount = healthIssues.length;
      setPill(
        "health",
        status.health,
        healthCount === 0 ? "Clear" : healthCount + (healthCount === 1 ? " issue" : " issues")
      );
      byId("health-summary").className = "health-summary" + (healthCount === 0 ? " clear" : "");
      byId("health-summary-label").textContent = healthCount === 0 ? "Clear" : "Needs attention";
      setList("health-list", healthIssues, "No workflow warnings.");
      byId("version").textContent = status.blueprint.version || "unknown";
      byId("adapters").textContent = status.blueprint.adapters.join(", ") || "none detected";
      byId("config").textContent = status.configuration.state === "project"
        ? "project settings"
        : status.configuration.state === "invalid"
          ? "invalid, using defaults"
          : "built-in defaults";
      byId("review-execution").textContent =
        status.configuration.values.review.independentExecution;
      byId("regular-gates").textContent = formatGates(
        status.configuration.values.qualityGates.regular
      );
      byId("continuous-gates").textContent = formatGates(
        status.configuration.values.qualityGates.continuous
      );
      byId("overview").textContent = status.plans.overview.state;
      byId("onboarding").textContent = status.onboarding.state;
      renderActivity(status.activity, status.configuration, status.nextAction);

      const build = status.plans.build;
      const work = status.currentWork;
      const buildPercent = build.total > 0 ? (build.completed / build.total) * 100 : 0;
      byId("build-count").textContent = build.completed + "/" + build.total + " complete";
      byId("build-progress").style.width = buildPercent + "%";
      byId("build-progressbar").setAttribute("aria-valuenow", String(Math.round(buildPercent)));
      byId("build-progressbar").setAttribute("aria-valuetext", build.completed + " of " + build.total + " build-plan items complete");
      const currentBuildItem = work.state === "active" && work.buildPlanItem
        ? build.items.find((item) => !item.checked && item.id === work.buildPlanItem)
        : null;
      let buildSummary = "Build plan is not ready.";
      if (currentBuildItem && !currentBuildItem.checked) {
        buildSummary = "Current: " + currentBuildItem.id + " - " + currentBuildItem.title;
      } else if (build.nextItem) {
        buildSummary = "Next: " + (build.nextItem.id ? build.nextItem.id + " - " : "") +
          build.nextItem.title;
      } else if (build.total > 0) {
        buildSummary = "All planned work is checked.";
      }
      byId("build-next").textContent = buildSummary;

      setBuildPlan(build.items, currentBuildItem ? currentBuildItem.id : null);
      setPill("work-state", work.state);
      byId("current-work-card").className = "card current-work " + work.state;
      byId("work-kicker").textContent = work.type
        ? work.type + (work.buildPlanItem ? " " + work.buildPlanItem : "")
        : "Blueprint idle";
      byId("work-title").textContent = work.title || "No active work";
      byId("work-count").textContent = work.total > 0
        ? work.completed + "/" + work.total + " steps"
        : "Idle";
      byId("work-meta").textContent = work.type
        ? work.type + (work.status ? " | " + work.status : "") + (work.buildPlanItem ? " | build-plan item " + work.buildPlanItem : "")
        : "Blueprint is idle.";
      const workPercent = work.total > 0 ? (work.completed / work.total) * 100 : 0;
      byId("work-progress").style.width = workPercent + "%";
      byId("work-progressbar").setAttribute("aria-valuenow", String(Math.round(workPercent)));
      byId("work-progressbar").setAttribute("aria-valuetext", work.completed + " of " + work.total + " build steps complete");
      setWorkSteps(work);
      setHistory(status.history);

      const git = status.git;
      setPill(
        "git-state",
        !git.available ? "unavailable" : git.clean ? "ok" : "warning",
        !git.available ? "Unavailable" : git.clean ? "Clean" : git.changedFiles + " changed"
      );
      byId("git-branch").textContent = git.branch || "unavailable";
      byId("git-changed").textContent = git.available ? String(git.changedFiles) : "unavailable";
      byId("git-upstream").textContent = git.upstream || "none";

      byId("findings-count").textContent = status.findings.active.length + " active";
      renderFindings(status.findings.active);

      setPill("completion-state", status.completion.state);
      setList("completion-list", status.completion.blockers, "No completion blockers.");
      byId("next-state-label").textContent = status.completion.state.replaceAll("_", " ");
      byId("next-state-label").className = status.completion.state;

      byId("next-command").textContent = status.nextAction.command || "No command required";
      byId("next-reason").textContent = status.nextAction.reason;
    }

    async function refresh() {
      if (refreshing || document.hidden) return;
      refreshing = true;

      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) throw new Error("Status request failed with " + response.status + ".");
        const text = await response.text();
        if (text !== lastPayload) {
          const firstRender = lastPayload === "";
          render(JSON.parse(text));
          lastPayload = text;
          if (firstRender) requestAnimationFrame(() => document.body.classList.add("hydrated"));
        }
        byId("live-state").className = "live";
        byId("live-label").textContent = "Connected";
      } catch (error) {
        byId("live-state").className = "live offline";
        byId("live-label").textContent = "Disconnected";
      } finally {
        refreshing = false;
      }
    }

    for (const button of document.querySelectorAll("[data-findings-sort]")) {
      button.addEventListener("click", () => promoteFindingsSort(button.dataset.findingsSort));
    }
    refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("refresh", refresh);
    setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
  </script>
</body>
</html>`;

export { DASHBOARD_HOST, openDashboard, startDashboardServer };

export type { DashboardServer, DashboardServerOptions };
