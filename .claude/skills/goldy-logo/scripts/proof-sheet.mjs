// Render an SVG logo to the proof sheet the audit gate requires: full size, small
// sizes, one flat colour, inverted on black, blurred, and in real-world context.
//
//   node proof-sheet.mjs logo.svg
//   node proof-sheet.mjs logo.svg mark.svg --out proof.png --sizes 96,48,24,16
//   node proof-sheet.mjs logo.svg --label "FINNROST — primary lockup"
//
// Drives headless Chrome over the DevTools protocol. Node 22+ (needs global WebSocket
// and fetch). No npm dependencies, and deliberately not cairosvg — cairo is painful to
// install on Windows, while a browser is already present and renders SVG exactly the
// way a viewer's browser will.
//
// Then LOOK AT THE PNG. The gate is not "the script exited 0", it is you reading the
// rendered letters against the intended spelling.

import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// --- args ---

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const svgPaths = argv.filter((a, i) =>
  !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

if (!svgPaths.length) {
  console.error('usage: node proof-sheet.mjs <logo.svg> [more.svg ...] [--out proof.png] [--sizes 96,48,24,16] [--label "..."]');
  process.exit(1);
}

const outPath = resolve(flag('out', 'proof-sheet.png'));
const sizes = flag('sizes', '96,48,24,16').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
const label = flag('label', '');
const WIDTH = 1200;

// --- build the sheet ---

function loadSvg(p) {
  if (!existsSync(p)) { console.error(`no such file: ${p}`); process.exit(1); }
  const raw = readFileSync(p, 'utf8');
  if (!/<svg[\s>]/i.test(raw)) { console.error(`not an SVG: ${p}`); process.exit(1); }
  for (const bad of ['<filter', '<image', 'xlink:href="data:image', '<feGaussianBlur', '<linearGradient', '<radialGradient']) {
    if (raw.includes(bad)) {
      console.warn(`warning: ${basename(p)} contains ${bad} — the doctrine forbids filters, embedded rasters and gradients in delivered artwork.`);
    }
  }
  // Strip the XML prolog so it can be inlined into HTML.
  return raw.replace(/<\?xml[^>]*\?>/i, '').trim();
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function panel(title, note, inner, cls = '') {
  return `<section class="panel ${cls}">
    <h2>${esc(title)}${note ? ` <span class="note">${esc(note)}</span>` : ''}</h2>
    <div class="stage">${inner}</div>
  </section>`;
}

function sheetFor(svg, name) {
  const at = (h, extra = '') => `<figure${extra ? ` class="${extra}"` : ''}><div class="art" style="height:${h}px">${svg}</div><figcaption>${h}px</figcaption></figure>`;

  return `
  <article class="doc">
    <h1>${esc(name)}${label ? ` — ${esc(label)}` : ''}</h1>

    ${panel('Full size', 'read every letter against the intended spelling', `<div class="art art-full">${svg}</div>`)}

    ${panel('Reduction', 'the smallest real size is the primary view', sizes.map((h) => at(h)).join(''))}

    ${panel('One flat colour', 'fax, stamp, embroidery, engraving, a sign at night', `<div class="art art-mid mono">${svg}</div>`, 'p-mono')}

    ${panel('Inverted', 'white on black — check counters do not fill in', `<div class="art art-mid invert">${svg}</div>`, 'p-invert')}

    ${panel('Blur test', 'from a passing bus — what survives is the logo', `
      <figure><div class="art b1" style="height:72px">${svg}</div><figcaption>slight</figcaption></figure>
      <figure><div class="art b2" style="height:72px">${svg}</div><figcaption>heavy</figcaption></figure>
      <figure><div class="art b3" style="height:28px">${svg}</div><figcaption>small + blurred</figcaption></figure>`)}

    ${panel('In context', 'business card, and a sign seen at distance', `
      <div class="card"><div class="art" style="height:26px">${svg}</div>
        <div class="card-lines"><span></span><span></span><span></span></div></div>
      <div class="sign"><div class="art" style="height:44px">${svg}</div></div>`)}
  </article>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>proof sheet</title>
<style>
  :root { --ink:#111; --rule:#e2e2e2; }
  * { box-sizing:border-box; }
  body { margin:0; padding:32px 36px 44px; width:${WIDTH}px; background:#fff; color:var(--ink);
         font:13px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; }
  h1 { font-size:15px; letter-spacing:.06em; text-transform:uppercase; margin:0 0 4px;
       padding-bottom:10px; border-bottom:2px solid var(--ink); }
  .doc + .doc { margin-top:40px; }
  .panel { padding:16px 0; border-bottom:1px solid var(--rule); }
  h2 { font-size:11px; letter-spacing:.09em; text-transform:uppercase; color:#666;
       margin:0 0 12px; font-weight:600; }
  .note { text-transform:none; letter-spacing:0; font-weight:400; color:#999; }
  .stage { display:flex; align-items:flex-end; gap:28px; flex-wrap:wrap; }
  .art svg { height:100%; width:auto; display:block; }
  /* Every .art box must carry an explicit height. A height of 100% against an
     auto-height parent computes to zero and the panel renders blank.
     preserveAspectRatio keeps the artwork undistorted if max-width clamps a
     very wide lockup. (No backticks in this file's CSS — it lives in a JS
     template literal and a backtick would end the string.) */
  .art-full { height:120px; }
  .art-full svg { max-width:100%; }
  .art-mid { height:64px; }
  figure { margin:0; display:flex; flex-direction:column; align-items:flex-start; gap:6px; }
  figcaption { font-size:10px; color:#999; }
  /* One flat colour: override every fill/stroke the artwork declares. */
  .mono svg, .mono svg * { fill:#000 !important; stroke:none !important; }
  .p-invert .stage { background:#000; padding:20px 24px; }
  .invert svg, .invert svg * { fill:#fff !important; stroke:none !important; }
  .b1 { filter:blur(1.2px); } .b2 { filter:blur(3.5px); } .b3 { filter:blur(1.1px); }
  .card { width:257px; height:162px; padding:18px; border:1px solid var(--rule);
          border-radius:3px; display:flex; flex-direction:column; justify-content:space-between;
          box-shadow:0 1px 3px rgba(0,0,0,.08); }
  .card-lines { display:flex; flex-direction:column; gap:5px; }
  .card-lines span { height:3px; background:#e8e8e8; border-radius:2px; }
  .card-lines span:nth-child(1){width:52%} .card-lines span:nth-child(2){width:38%}
  .card-lines span:nth-child(3){width:45%}
  .sign { width:330px; height:110px; background:#2b2b2b; border-radius:3px;
          display:flex; align-items:center; justify-content:center; }
  .sign svg, .sign svg * { fill:#fff !important; }
</style></head><body>
${svgPaths.map((p) => sheetFor(loadSvg(p), basename(p))).join('\n')}
</body></html>`;

// --- render through Chrome ---

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const candidates = {
    win32: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
  }[process.platform] ?? [];
  return candidates.find(existsSync);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('No Chrome/Chromium/Edge found. Set CHROME=/path/to/chrome and retry.');
    process.exit(1);
  }

  const work = mkdtempSync(join(tmpdir(), 'proof-'));
  const htmlPath = join(work, 'sheet.html');
  writeFileSync(htmlPath, html, 'utf8');

  const port = 9500 + Math.floor(Math.random() * 400);
  const proc = spawn(chrome, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(work, 'profile')}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--force-device-scale-factor=1', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });

  const cleanup = () => {
    try { proc.kill('SIGKILL'); } catch {}
    try { rmSync(work, { recursive: true, force: true }); } catch {}
  };

  try {
    let wsUrl = null;
    for (let i = 0; i < 100 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      } catch { /* not up yet */ }
      if (!wsUrl) await sleep(100);
    }
    if (!wsUrl) throw new Error('Chrome did not expose a debugging target in 10s.');

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')); });

    let id = 0;
    const pending = new Map();
    const events = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(`${msg.error.message}`)) : res(msg.result);
      } else if (msg.method && events.has(msg.method)) {
        events.get(msg.method)();
        events.delete(msg.method);
      }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    const once = (method) => new Promise((res) => events.set(method, res));

    await send('Page.enable');
    // Set metrics BEFORE navigating, or the page lays out at the default width first.
    await send('Emulation.setDeviceMetricsOverride',
      { width: WIDTH, height: 900, deviceScaleFactor: 2, mobile: false });

    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(htmlPath).href });
    await Promise.race([loaded, sleep(15000)]);

    // Inline SVG has no network fetch to wait on, but give layout/fonts a beat to settle.
    await sleep(350);

    const { result } = await send('Runtime.evaluate',
      { expression: 'document.documentElement.scrollHeight', returnByValue: true });
    const height = Math.min(Math.ceil(result.value) + 20, 16000);

    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: WIDTH, height, scale: 1 },
    });
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    ws.close();

    console.log(`proof sheet: ${outPath}  (${WIDTH}x${height} @2x)`);
    console.log('Now OPEN IT and read the letters against the intended spelling. The gate is the picture, not the exit code.');
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error(`proof-sheet failed: ${e.message}`); process.exit(1); });
