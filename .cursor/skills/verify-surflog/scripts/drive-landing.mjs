#!/usr/bin/env node
/**
 * Drive the signed-out landing in a fresh headless Chrome.
 * Writes screenshots + transcript.json under evidence/<timestamp>/.
 * Does not complete Google OAuth and does not touch Supabase.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, openSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../../..");
const stateDir = path.join(root, ".cursor/skills/verify-surflog/run");
const evidenceRoot = path.join(root, ".cursor/skills/verify-surflog/evidence");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidence = path.join(evidenceRoot, stamp);
const portFile = path.join(stateDir, "port");
const appPort = existsSync(portFile)
  ? Number(readFileSync(portFile, "utf8").trim())
  : Number(process.env.PORT || 3000);
const base = process.env.VERIFY_BASE_URL || `http://127.0.0.1:${appPort}`;
const debugPort = Number(process.env.VERIFY_CHROME_PORT || 9333);
const chromeBin = process.env.CHROME_BIN || "google-chrome";

const HERO_EN = "Log it easy. Surf it better.";
const HERO_ZH = "輕鬆記錄每次下水，陪你衝浪進步的好幫手";

mkdirSync(evidence, { recursive: true });
writeFileSync(path.join(evidenceRoot, "LATEST"), evidence + "\n");

const steps = [];
function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

let chrome = null;
let cdp = null;

function killChrome() {
  if (!chrome || chrome.killed || chrome.exitCode != null) return;
  const pid = chrome.pid;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try { chrome.kill("SIGTERM"); } catch { /* already gone */ }
  }
}

async function main() {
  const probe = await fetch(base + "/", { redirect: "manual" }).catch((e) => {
    throw new Error(`app not reachable at ${base}/ (${e.message}). Run launch.sh first.`);
  });
  const html = await probe.text();
  if (probe.status !== 200 || !html.includes(HERO_EN)) {
    throw new Error(`GET ${base}/ is ${probe.status} and has no landing hero. Run doctor.sh.`);
  }

  rmSync(path.join(stateDir, "chrome-profile"), { recursive: true, force: true });
  mkdirSync(stateDir, { recursive: true });
  const chromeLog = path.join(stateDir, "chrome.log");
  const logFd = openSync(chromeLog, "w");
  chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-translate",
    "--lang=en-US",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${path.join(stateDir, "chrome-profile")}`,
    "about:blank",
  ], { detached: true, stdio: ["ignore", logFd, logFd] });
  writeFileSync(path.join(stateDir, "chrome.pid"), String(chrome.pid));
  writeFileSync(path.join(stateDir, "chrome.port"), String(debugPort));

  const version = await waitHttp(`http://127.0.0.1:${debugPort}/json/version`, 15000);
  const browserWs = JSON.parse(version).webSocketDebuggerUrl;
  cdp = await connect(browserWs);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  cdp.sessionId = sessionId;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await cdp.send("Page.navigate", { url: base + "/" });
  await waitExpr(`document.querySelector("h1")?.textContent?.includes(${JSON.stringify(HERO_EN)})`, 30000);
  // The hero is in the server HTML. Clicks before hydration are dropped.
  await waitExpr(`!!window.next && performance.getEntriesByType("resource").some((r) => r.name.includes("/_next/static"))`, 30000);
  await delay(400);
  record("hero-en", true, HERO_EN);
  await shot("01-landing-en.png");

  const clickedZh = await clickLang("中文");
  if (!clickedZh.ok) throw new Error("language button 中文 not found: " + JSON.stringify(clickedZh));
  await waitExpr(`document.querySelector("h1")?.textContent?.includes(${JSON.stringify(HERO_ZH)})`, 10000);
  const langZh = await evalJson(`({
    storage: localStorage.getItem("surflog:lang"),
    html: document.documentElement.lang
  })`);
  const zhOk = langZh.storage === "zh-TW" && langZh.html === "zh-TW";
  record("lang-zh-TW", zhOk, JSON.stringify(langZh));
  await shot("02-landing-zh.png");
  if (!zhOk) throw new Error("language did not stick: " + JSON.stringify(langZh));

  const clickedEn = await clickLang("EN");
  if (!clickedEn.ok) throw new Error("language button EN not found: " + JSON.stringify(clickedEn));
  await waitExpr(`document.querySelector("h1")?.textContent?.includes(${JSON.stringify(HERO_EN)})`, 10000);
  const langEn = await evalJson(`localStorage.getItem("surflog:lang")`);
  record("lang-en", langEn === "en", String(langEn));
  if (langEn !== "en") throw new Error("expected localStorage surflog:lang=en, got " + langEn);

  const cond = await evalJson(`(() => {
    const h2 = [...document.querySelectorAll("h2")].find((h) => h.textContent.includes("Conditions fill themselves"));
    if (h2) h2.scrollIntoView({ block: "center" });
    return {
      heading: !!h2,
      jialeshui: document.body.innerText.includes("Jialeshui"),
    };
  })()`);
  record("conditions-section", cond.heading && cond.jialeshui, JSON.stringify(cond));
  await delay(300);
  await shot("03-conditions.png");
  if (!cond.heading || !cond.jialeshui) throw new Error("conditions section missing Jialeshui");

  await cdp.send("Page.navigate", { url: base + "/spots" });
  await waitExpr(`location.pathname === "/signin" && location.search.includes("callbackUrl")`, 20000);
  const gate = await evalJson(`({
    path: location.pathname + location.search,
    google: document.body.innerText.includes("Continue with Google")
  })`);
  const gateOk = gate.path.startsWith("/signin") && gate.google;
  record("spots-gate", gateOk, gate.path);
  await shot("04-signin-gate.png");
  if (!gateOk) throw new Error(" /spots did not land on the sign-in card: " + JSON.stringify(gate));

  await cdp.send("Page.navigate", { url: base + "/" });
  await waitExpr(`document.querySelector("h1")?.textContent?.includes(${JSON.stringify(HERO_EN)})`, 20000);
  const clickedSignIn = await evalJson(`(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Sign in");
    if (!btn) return { ok: false };
    btn.click();
    return { ok: true };
  })()`);
  if (!clickedSignIn.ok) throw new Error("header Sign in button not found");
  const hrefBefore = base + "/";
  let hrefAfter = hrefBefore;
  const navStart = Date.now();
  while (Date.now() - navStart < 8000) {
    try {
      hrefAfter = await evalJson(`location.href`);
      if (hrefAfter !== hrefBefore) break;
    } catch {
      // The click navigates; the old document's context goes away mid-eval.
    }
    await delay(200);
  }
  await shot("05-after-sign-in-click.png");
  // Google's page cannot read our cookie. Come back to this origin and read the session there.
  await cdp.send("Page.navigate", { url: base + "/api/auth/session" });
  await waitExpr(`document.body && (document.body.innerText.includes("null") || document.body.innerText.includes("user"))`, 15000);
  const sessionText = await evalJson(`document.body.innerText.slice(0, 500)`);
  let session = null;
  try { session = JSON.parse(sessionText); } catch { session = { unparsed: sessionText }; }
  const userId = session && typeof session === "object" ? session.user?.id : null;
  const stayedOut = !userId;
  let oauth = "stayed-on-origin";
  if (hrefAfter.includes("accounts.google.com")) oauth = "reached-google";
  const googleError = hrefAfter.includes("invalid_client") || hrefAfter.includes("authError");
  record(
    "sign-in-does-not-enter-journal",
    stayedOut,
    `${oauth}${googleError ? " invalid-client" : ""} session=${sessionText.slice(0, 80)}`
  );
  writeFileSync(path.join(evidence, "sign-in-observation.json"), JSON.stringify({
    hrefAfter: hrefAfter.split("?")[0] + (hrefAfter.includes("accounts.google.com") ? " (query stripped)" : ""),
    googleHost: hrefAfter.includes("accounts.google.com"),
    invalidClient: googleError,
    session,
  }, null, 2));
  if (!stayedOut) throw new Error("sign-in click produced a user id without a completed human login");

  const passed = steps.every((s) => s.ok);
  writeTranscript(passed, null);
  if (!passed) process.exitCode = 1;
}

function writeTranscript(passed, error) {
  const doc = {
    feature: "landing",
    base,
    passed,
    error,
    at: new Date().toISOString(),
    note: "Signed-out production landing. The conditions card is the landing's own demo data (components/landing/demo-data.ts), not a sessions row. No Supabase write. Google OAuth was not completed.",
    steps,
  };
  writeFileSync(path.join(evidence, "transcript.json"), JSON.stringify(doc, null, 2));
  console.log(`evidence: ${evidence}`);
}

async function shot(name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path.join(evidence, name), Buffer.from(data, "base64"));
}

async function clickLang(label) {
  return evalJson(`(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === ${JSON.stringify(label)} && b.hasAttribute("aria-pressed")
    );
    if (!btn) return { ok: false, buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).slice(0, 20) };
    btn.click();
    return { ok: true, pressed: btn.getAttribute("aria-pressed") };
  })()`, true);
}

async function evalJson(expression, userGesture = false) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture,
  });
  if (result.exceptionDetails) {
    throw new Error("eval failed: " + JSON.stringify(result.exceptionDetails).slice(0, 400));
  }
  return result.result.value;
}

async function waitExpr(expression, timeoutMs) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    last = result.exceptionDetails ? "exception" : result.result?.value;
    if (!result.exceptionDetails && result.result?.value) return result.result.value;
    await delay(200);
  }
  throw new Error(`timed out waiting for ${expression} (last=${JSON.stringify(last)})`);
}

async function waitHttp(url, timeoutMs) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      last = String(res.status);
    } catch (e) {
      last = e.message;
    }
    await delay(200);
  }
  throw new Error(`timed out waiting for ${url} (${last}). See ${path.join(stateDir, "chrome.log")}`);
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let next = 1;
  const client = {
    sessionId: undefined,
    send(method, params = {}) {
      const id = next++;
      const payload = { id, method, params };
      if (client.sessionId) payload.sessionId = client.sessionId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify(payload));
      });
    },
  };
  const events = [];
  client.events = events;
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method) events.push(msg);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(methodOf(msg) + " " + JSON.stringify(msg.error)));
    else resolve(msg.result || {});
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(client));
    ws.addEventListener("error", () => reject(new Error("chrome websocket failed")));
  });
}

function methodOf() { return "cdp"; }

try {
  await main();
} catch (err) {
  record("drive", false, err.message);
  try {
    if (cdp) {
      await shot("failure.png");
      const snap = await evalJson(`({
        h1: document.querySelector("h1")?.textContent ?? null,
        lang: document.documentElement.lang,
        storage: localStorage.getItem("surflog:lang"),
        next: typeof window.next
      })`).catch((e) => ({ evalError: e.message }));
      writeFileSync(path.join(evidence, "failure-dom.json"), JSON.stringify({
        snap,
        events: (cdp.events || []).slice(-30).map((e) => e.method),
      }, null, 2));
    }
  } catch { /* keep the original error */ }
  try { writeTranscript(false, err.message); } catch { /* evidence dir exists */ }
  console.error(err);
  process.exitCode = 1;
} finally {
  killChrome();
  await delay(300);
  try {
    if (chrome?.pid) process.kill(-chrome.pid, "SIGKILL");
  } catch { /* group already gone */ }
}
