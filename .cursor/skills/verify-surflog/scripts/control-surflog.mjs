#!/usr/bin/env node
/**
 * control-surflog — verification harness for Surflog (verification scaffolding).
 *
 * Owns a disposable Next.js instance + Chrome (playwright-core + system Chrome).
 * Never drive an instance you did not start with `launch`.
 *
 *   control-surflog launch [--port 3456] [--mode ui|full]
 *   control-surflog doctor
 *   control-surflog stop
 *   control-surflog browser goto <pathOrUrl>
 *   control-surflog browser click --name <accessibleName> [--role button]
 *   control-surflog browser click --selector <css>
 *   control-surflog browser text --name <accessibleName> [--role heading]
 *   control-surflog browser wait --text <substring> [--timeoutMs 15000]
 *   control-surflog browser screenshot --path <file>
 *   control-surflog browser aria --path <file>
 *   control-surflog browser eval <jsExpression>
 *   control-surflog http get <path>
 */

import { spawn, execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  unlinkSync,
  openSync,
  readdirSync,
  readlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
// scripts → verify-surflog → skills → .cursor → repo root
const REPO_ROOT = resolve(__dirname, "../../../..");
const STATE_DIR =
  process.env.SURFLOG_VERIFY_STATE_DIR ||
  join("/tmp", `surflog-verify-${process.env.USER || "agent"}`);
const STATE_FILE = join(STATE_DIR, "state.json");
const DEFAULT_PORT = Number(process.env.SURFLOG_VERIFY_PORT || 3456);
const READY_PATH = "/dev/landing";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveState(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState() {
  if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE);
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portOwnerPids(port) {
  // Prefer /proc: lsof is often empty in locked-down agent VMs.
  const hex = port.toString(16).toUpperCase().padStart(4, "0");
  const inodes = new Set();
  for (const path of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const local = parts[1];
      const st = parts[3];
      if (st === "0A" && local.toUpperCase().endsWith(":" + hex)) {
        inodes.add(parts[9]);
      }
    }
  }
  if (inodes.size === 0) {
    try {
      const out = execFileSync("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      return out
        ? out
            .split("\n")
            .map(Number)
            .filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }
  const pids = new Set();
  for (const dir of readdirSafe("/proc")) {
    if (!/^\d+$/.test(dir)) continue;
    const fdDir = join("/proc", dir, "fd");
    for (const fd of readdirSafe(fdDir)) {
      try {
        const target = readlinkSafe(join(fdDir, fd));
        for (const inode of inodes) {
          if (target === `socket:[${inode}]`) pids.add(Number(dir));
        }
      } catch {
        /* ignore */
      }
    }
  }
  return [...pids];
}

function readdirSafe(path) {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

function readlinkSafe(path) {
  return readlinkSync(path);
}

function descendantPids(rootPid) {
  const kids = new Map();
  for (const dir of readdirSafe("/proc")) {
    if (!/^\d+$/.test(dir)) continue;
    try {
      const stat = readFileSync(join("/proc", dir, "stat"), "utf8");
      const close = stat.indexOf(")");
      const rest = stat.slice(close + 2).split(" ");
      const ppid = Number(rest[1]);
      if (!kids.has(ppid)) kids.set(ppid, []);
      kids.get(ppid).push(Number(dir));
    } catch {
      /* ignore */
    }
  }
  const out = new Set([rootPid]);
  const stack = [rootPid];
  while (stack.length) {
    const p = stack.pop();
    for (const c of kids.get(p) || []) {
      if (!out.has(c)) {
        out.add(c);
        stack.push(c);
      }
    }
  }
  return out;
}

function weOwnPort(rootPid, port) {
  const owners = portOwnerPids(port);
  if (owners.length === 0) return false;
  const tree = descendantPids(rootPid);
  return owners.some((p) => tree.has(p));
}

function killTree(rootPid, signal = "SIGTERM") {
  const tree = [...descendantPids(rootPid)].sort((a, b) => b - a);
  for (const pid of tree) {
    try {
      process.kill(pid, signal);
    } catch {
      /* ignore */
    }
  }
}

async function fetchOk(url, timeoutMs = 4000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "manual" });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function chromePath() {
  for (const p of [
    process.env.CHROME_PATH,
    "/usr/local/bin/google-chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

async function getPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright-core");
  } catch {
    die(
      "playwright-core missing. From .cursor/skills/verify-surflog/scripts run:\n  npm install"
    );
  }
}

function baseUrl(state) {
  return state?.baseUrl || `http://127.0.0.1:${DEFAULT_PORT}`;
}

function resolveTarget(state, pathOrUrl) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl(state).replace(/\/$/, "");
  return pathOrUrl.startsWith("/") ? base + pathOrUrl : `${base}/${pathOrUrl}`;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    } else out._.push(a);
  }
  return out;
}

async function ensureChrome(state) {
  const { chromium } = await getPlaywright();
  const chrome = chromePath();
  if (!chrome) die("Google Chrome / Chromium not found. Set CHROME_PATH.");

  const userDataDir = join(STATE_DIR, "chrome-profile");
  const debugPort = state.chromeDebugPort || 3457;
  mkdirSync(userDataDir, { recursive: true });

  if (state.chromePid && pidAlive(state.chromePid)) {
    try {
      const browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${debugPort}`
      );
      const context = browser.contexts()[0] || (await browser.newContext());
      const page = context.pages()[0] || (await context.newPage());
      return { browser, page, detachOnly: true };
    } catch {
      /* relaunch below */
    }
  }

  const headless = process.env.SURFLOG_VERIFY_HEADED !== "1";
  const args = [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ];
  if (headless) args.unshift("--headless=new");

  const child = spawn(chrome, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  let browser;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
      break;
    } catch {
      /* retry */
    }
  }
  if (!browser) {
    try {
      process.kill(child.pid, "SIGKILL");
    } catch {
      /* ignore */
    }
    die("Chrome failed to open remote debugging port.");
  }

  const context = browser.contexts()[0] || (await browser.newContext());
  await context.setViewportSize?.({ width: 1280, height: 850 }).catch(() => {});
  const page = context.pages()[0] || (await context.newPage());
  try {
    await page.setViewportSize({ width: 1280, height: 850 });
  } catch {
    /* ignore */
  }

  state.chromePid = child.pid;
  state.chromeDebugPort = debugPort;
  saveState(state);
  return { browser, page, detachOnly: true };
}

async function withPage(fn) {
  const state = loadState();
  if (!state?.pid || !(pidAlive(state.pid) || (state.listenerPids || []).some(pidAlive))) {
    die("No live Surflog verify instance. Run: control-surflog launch");
  }
  const session = await ensureChrome(state);
  try {
    return await fn(session.page, state);
  } finally {
    // Leave Chrome running so the next control-surflog browser command
    // reuses the same tab/session. Stopped only by `control-surflog stop`.
    await session.browser.close().catch(() => {});
  }
}

async function cmdLaunch(args) {
  const port = Number(args.port || DEFAULT_PORT);
  const mode = args.mode === "full" ? "full" : "ui";
  mkdirSync(STATE_DIR, { recursive: true });

  const existing = loadState();
  if (existing?.pid && pidAlive(existing.pid)) {
    die(
      `Already running pid=${existing.pid} at ${existing.baseUrl}. Run control-surflog stop first.`
    );
  }
  const owners = portOwnerPids(port);
  if (owners.length) {
    die(
      `Port ${port} already owned by pid(s) ${owners.join(",")}. Pick another --port or free it.`
    );
  }

  const authSecret =
    process.env.AUTH_SECRET ||
    (existsSync("/tmp/surflog-verify-auth-secret.txt")
      ? readFileSync("/tmp/surflog-verify-auth-secret.txt", "utf8").trim()
      : null) ||
    execFileSync("openssl", ["rand", "-base64", "33"], { encoding: "utf8" }).trim();

  const env = {
    ...process.env,
    PORT: String(port),
    AUTH_SECRET: authSecret,
    AUTH_GOOGLE_ID:
      process.env.AUTH_GOOGLE_ID || "verify-placeholder.apps.googleusercontent.com",
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || "verify-placeholder-secret",
    NODE_ENV: "development",
  };
  if (mode === "full") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      die(
        "full mode needs SUPABASE_URL and SUPABASE_SECRET_KEY in the environment."
      );
    }
  }

  const logPath = join(STATE_DIR, "next.log");
  writeFileSync(logPath, "");
  const out = openSync(logPath, "a");
  const child = spawn(
    "npx",
    ["next", "dev", "--webpack", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: REPO_ROOT,
      env,
      detached: true,
      stdio: ["ignore", out, out],
    }
  );
  child.unref();

  const base = `http://127.0.0.1:${port}`;
  const readyUrl = base + READY_PATH;
  let ready = false;
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if (!pidAlive(child.pid)) {
      die(`Next.js exited early. See ${logPath}`);
    }
    const res = await fetchOk(readyUrl, 2000);
    if (res && res.status === 200) {
      const body = await res.text();
      if (body.includes("Surflog") || body.includes("surflog-logo")) {
        ready = true;
        break;
      }
    }
  }
  if (!ready) {
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
      /* ignore */
    }
    die(`Timed out waiting for ${readyUrl}. See ${logPath}`);
  }

  const listeners = portOwnerPids(port);
  const state = {
    pid: child.pid,
    listenerPids: listeners,
    port,
    baseUrl: base,
    mode,
    readyPath: READY_PATH,
    logPath,
    stateDir: STATE_DIR,
    startedAt: new Date().toISOString(),
    repoRoot: REPO_ROOT,
  };
  saveState(state);
  console.log(
    JSON.stringify(
      {
        ok: true,
        pid: state.pid,
        listenerPids: listeners,
        baseUrl: state.baseUrl,
        mode: state.mode,
        ready: READY_PATH,
        logPath,
        stateDir: STATE_DIR,
      },
      null,
      2
    )
  );
}

async function cmdDoctor() {
  const state = loadState();
  const report = {
    ok: false,
    stateFile: STATE_FILE,
    state: null,
    processAlive: false,
    portOwnerMatches: false,
    readyStatus: null,
    healthStatus: null,
    mode: null,
    notes: [],
  };

  if (!state) {
    report.notes.push("No state file — run control-surflog launch.");
    console.log(JSON.stringify(report, null, 2));
    process.exit(2);
  }
  report.state = state;
  report.mode = state.mode;
  report.processAlive = pidAlive(state.pid) || (state.listenerPids || []).some(pidAlive);
  report.portOwners = portOwnerPids(state.port);
  report.portOwnerMatches = weOwnPort(state.pid, state.port);
  if (!report.portOwnerMatches) {
    report.notes.push(
      `Port ${state.port} owner pid(s)=${report.portOwners.join(",") || "none"} not in tree of ${state.pid}. Refuse to drive.`
    );
  }

  const ready = await fetchOk(baseUrl(state) + state.readyPath, 4000);
  report.readyStatus = ready ? ready.status : null;
  if (ready?.status === 200) {
    const text = await ready.text();
    if (!/Surflog|surflog-logo/.test(text)) {
      report.notes.push("Ready path 200 but Surflog mark missing in HTML.");
    }
  } else {
    report.notes.push(`Ready path ${state.readyPath} not 200.`);
  }

  const health = await fetchOk(baseUrl(state) + "/api/health", 4000);
  report.healthStatus = health ? health.status : null;
  if (state.mode === "full" && health?.status !== 200) {
    report.notes.push("full mode expects /api/health → 200 {ok:true}.");
  } else if (state.mode === "ui" && health?.status === 200) {
    report.notes.push("ui mode: /api/health is optional; DB appears reachable.");
  } else if (state.mode === "ui") {
    report.notes.push("ui mode: /api/health not ok (expected without Supabase).");
  }

  const refuse = report.notes.some((n) => n.includes("Refuse") || n.includes("Surflog mark missing"));
  const fullHealthOk = state.mode !== "full" || health?.status === 200;
  report.ok =
    report.processAlive &&
    report.portOwnerMatches &&
    report.readyStatus === 200 &&
    !refuse &&
    fullHealthOk;

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 2);
}

async function cmdStop() {
  const state = loadState();
  if (!state) {
    console.log(JSON.stringify({ ok: true, stopped: false, reason: "no state" }));
    return;
  }
  const killed = [...descendantPids(state.pid)];
  if (state.pid) killTree(state.pid, "SIGTERM");
  for (let i = 0; i < 20; i++) {
    if (![...descendantPids(state.pid)].some(pidAlive)) break;
    await sleep(200);
  }
  if ([...descendantPids(state.pid)].some(pidAlive) || (state.listenerPids || []).some(pidAlive)) {
    if (state.pid) killTree(state.pid, "SIGKILL");
    for (const lp of state.listenerPids || []) {
      try {
        process.kill(lp, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }
  if (state.chromePid && pidAlive(state.chromePid)) {
    try {
      process.kill(state.chromePid, "SIGTERM");
    } catch {
      /* ignore */
    }
    await sleep(400);
    if (pidAlive(state.chromePid)) {
      try {
        process.kill(state.chromePid, "SIGKILL");
      } catch {
        /* ignore */
      }
    }
    killed.push(state.chromePid);
  }
  const chromeProfile = join(STATE_DIR, "chrome-profile");
  if (existsSync(chromeProfile)) {
    rmSync(chromeProfile, { recursive: true, force: true });
  }
  clearState();
  console.log(
    JSON.stringify({
      ok: true,
      stopped: true,
      killed,
      evidenceNote:
        "Proof under .cursor/skills/verify-surflog/artifacts/ is kept.",
      stateDirKept: STATE_DIR,
    })
  );
}

async function findByRoleName(page, role, name) {
  return page.getByRole(role, { name, exact: false }).first();
}

async function cmdBrowser(argv) {
  const sub = argv[0];
  const args = parseArgs(argv.slice(1));
  if (!sub) die("browser needs a subcommand");

  if (sub === "goto") {
    const target = args._[0];
    if (!target) die("browser goto <pathOrUrl>");
    await withPage(async (page, state) => {
      const url = resolveTarget(state, target);
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log(
        JSON.stringify({ ok: true, url: page.url(), status: res?.status() ?? null })
      );
    });
    return;
  }

  if (sub === "click") {
    await withPage(async (page) => {
      let loc;
      if (args.selector) loc = page.locator(args.selector).first();
      else {
        const role = args.role || "button";
        const name = args.name;
        if (!name) die("browser click needs --name or --selector");
        loc = await findByRoleName(page, role, name);
      }
      await loc.click({ timeout: 10000 });
      console.log(JSON.stringify({ ok: true, clicked: args.name || args.selector }));
    });
    return;
  }

  if (sub === "text") {
    await withPage(async (page) => {
      const role = args.role || "heading";
      const name = args.name;
      if (!name) die("browser text needs --name");
      const loc = await findByRoleName(page, role, name);
      const visible = await loc.isVisible().catch(() => false);
      const text = visible ? await loc.innerText() : null;
      console.log(JSON.stringify({ ok: visible, role, name, text }));
      if (!visible) process.exit(2);
    });
    return;
  }

  if (sub === "wait") {
    const text = args.text;
    if (!text) die("browser wait --text <substring>");
    const timeout = Number(args.timeoutMs || 15000);
    const stateName = args.state === "attached" ? "attached" : "visible";
    await withPage(async (page) => {
      const loc = page.getByText(text, { exact: false }).first();
      await loc.waitFor({ state: stateName, timeout });
      if (args.scroll) {
        await loc.scrollIntoViewIfNeeded().catch(() => {});
      }
      console.log(JSON.stringify({ ok: true, text, state: stateName }));
    });
    return;
  }

  if (sub === "screenshot") {
    const path = args.path;
    if (!path) die("browser screenshot --path <file>");
    const abs = resolve(path);
    mkdirSync(dirname(abs), { recursive: true });
    await withPage(async (page) => {
      await page.screenshot({ path: abs, fullPage: Boolean(args.fullPage) });
      console.log(JSON.stringify({ ok: true, path: abs, url: page.url() }));
    });
    return;
  }

  if (sub === "aria") {
    const path = args.path;
    if (!path) die("browser aria --path <file>");
    const abs = resolve(path);
    mkdirSync(dirname(abs), { recursive: true });
    await withPage(async (page) => {
      const snapshot = await page.locator("body").ariaSnapshot();
      writeFileSync(abs, snapshot);
      console.log(JSON.stringify({ ok: true, path: abs, bytes: snapshot.length }));
    });
    return;
  }

  if (sub === "eval") {
    const expr = args._.join(" ");
    if (!expr) die("browser eval <jsExpression>");
    await withPage(async (page) => {
      const result = await page.evaluate(expr);
      console.log(JSON.stringify({ ok: true, result }, null, 2));
    });
    return;
  }

  die(`unknown browser subcommand: ${sub}`);
}

async function cmdHttp(argv) {
  const sub = argv[0];
  const args = parseArgs(argv.slice(1));
  if (sub !== "get") die("http get <path>");
  const path = args._[0];
  if (!path) die("http get <path>");
  const state = loadState();
  if (!state) die("No state — launch first");
  const url = resolveTarget(state, path);
  const res = await fetchOk(url, 10000);
  if (!res) die(`request failed: ${url}`);
  const body = await res.text();
  console.log(
    JSON.stringify({
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      url,
      body: body.slice(0, 2000),
    })
  );
  if (res.status >= 400) process.exit(2);
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "help" || cmd === "--help") {
    console.log("control-surflog launch|doctor|stop|browser|http …");
    process.exit(0);
  }
  const args = parseArgs(argv.slice(1));
  if (cmd === "launch") return cmdLaunch(args);
  if (cmd === "doctor") return cmdDoctor();
  if (cmd === "stop") return cmdStop();
  if (cmd === "browser") return cmdBrowser(argv.slice(1));
  if (cmd === "http") return cmdHttp(argv.slice(1));
  die(`unknown command: ${cmd}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
