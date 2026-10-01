#!/usr/bin/env node
// Cross-platform font discovery. Replaces `fc-list`, which does not exist on Windows.
//
//   node find-fonts.mjs                 list every installed family
//   node find-fonts.mjs grotesk         filter by substring (family, style or filename)
//   node find-fonts.mjs --json          machine-readable
//   node find-fonts.mjs --files         print one line per file instead of per family
//
// Reads the sfnt `name` table directly, so family names are the real ones the type
// designer set, not guesses from the filename. No dependencies.

import { readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { homedir, platform } from 'node:os';

const FONT_DIRS = {
  win32: ['C:/Windows/Fonts', join(homedir(), 'AppData/Local/Microsoft/Windows/Fonts')],
  darwin: ['/System/Library/Fonts', '/Library/Fonts', join(homedir(), 'Library/Fonts')],
  linux: ['/usr/share/fonts', '/usr/local/share/fonts', join(homedir(), '.fonts'), join(homedir(), '.local/share/fonts')],
}[platform()] ?? ['/usr/share/fonts'];

const EXTS = new Set(['.ttf', '.otf', '.ttc', '.otc']);

function walk(dir, out = [], depth = 0) {
  if (depth > 4) return out;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e.name);
    try {
      if (e.isDirectory()) walk(p, out, depth + 1);
      else if (EXTS.has(extname(e.name).toLowerCase()) && statSync(p).size > 0) out.push(p);
    } catch { /* unreadable font file — skip */ }
  }
  return out;
}

// --- minimal sfnt reader: just enough to pull nameID 1 (family) and 2 (style) ---

function readAt(fd, offset, length) {
  const buf = Buffer.alloc(length);
  const got = readSync(fd, buf, 0, length, offset);
  return got < length ? buf.subarray(0, got) : buf;
}

function namesFromOffset(fd, base) {
  const header = readAt(fd, base, 12);
  if (header.length < 12) return null;
  const numTables = header.readUInt16BE(4);
  if (numTables === 0 || numTables > 512) return null;

  const dir = readAt(fd, base + 12, numTables * 16);
  let nameOff = 0;
  for (let i = 0; i < numTables; i++) {
    const rec = dir.subarray(i * 16, i * 16 + 16);
    if (rec.length < 16) break;
    if (rec.toString('latin1', 0, 4) === 'name') { nameOff = rec.readUInt32BE(8); break; }
  }
  if (!nameOff) return null;

  const nh = readAt(fd, nameOff, 6);
  if (nh.length < 6) return null;
  const count = nh.readUInt16BE(2);
  const storage = nameOff + nh.readUInt16BE(4);
  const records = readAt(fd, nameOff + 6, count * 12);

  // A face carries the same name once per (platform, language). Without an explicit
  // preference you get whichever came last in the table — which is how "Bold Italic"
  // comes back as "Gras Italique". Score the records and keep the best.
  const score = (platformID, languageID) => {
    if (platformID === 3 && languageID === 0x0409) return 4; // Windows, en-US
    if (platformID === 0) return 3;                          // Unicode
    if (platformID === 1 && languageID === 0) return 3;      // Mac, English
    if (platformID === 3) return 2;                          // Windows, other language
    return 1;
  };

  const picked = {};
  for (let i = 0; i < count; i++) {
    const r = records.subarray(i * 12, i * 12 + 12);
    if (r.length < 12) break;
    const platformID = r.readUInt16BE(0);
    const languageID = r.readUInt16BE(4);
    const nameID = r.readUInt16BE(6);
    if (nameID !== 1 && nameID !== 2) continue;

    const len = r.readUInt16BE(8);
    const off = r.readUInt16BE(10);
    if (len === 0 || len > 512) continue;
    const raw = readAt(fd, storage + off, len);
    // platform 3 (Windows) and 0 (Unicode) are UTF-16BE; platform 1 (Mac) is single-byte.
    const text = (platformID === 3 || platformID === 0)
      ? raw.swap16().toString('utf16le').replace(/\0/g, '')
      : raw.toString('latin1');
    const clean = text.trim();
    if (!clean) continue;

    const s = score(platformID, languageID);
    if (!picked[nameID] || s > picked[nameID].score) picked[nameID] = { text: clean, score: s };
  }
  return picked[1] ? { family: picked[1].text, style: picked[2]?.text || 'Regular' } : null;
}

function readFont(path) {
  let fd;
  try { fd = openSync(path, 'r'); } catch { return []; }
  try {
    const tag = readAt(fd, 0, 4).toString('latin1');
    if (tag === 'ttcf') {
      // Font collection: a header of offsets, each pointing at a real sfnt.
      const head = readAt(fd, 0, 12);
      const n = Math.min(head.readUInt32BE(8), 64);
      const offsets = readAt(fd, 12, n * 4);
      const out = [];
      for (let i = 0; i < n; i++) {
        if ((i + 1) * 4 > offsets.length) break;
        const got = namesFromOffset(fd, offsets.readUInt32BE(i * 4));
        if (got) out.push({ ...got, path });
      }
      return out;
    }
    const got = namesFromOffset(fd, 0);
    return got ? [{ ...got, path }] : [];
  } catch {
    return [];
  } finally {
    closeSync(fd);
  }
}

// --- main ---

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const perFile = args.includes('--files');
const needle = args.find((a) => !a.startsWith('--'))?.toLowerCase();

const files = FONT_DIRS.flatMap((d) => walk(d));
let faces = files.flatMap(readFont);

if (needle) {
  faces = faces.filter((f) =>
    f.family.toLowerCase().includes(needle) ||
    f.style.toLowerCase().includes(needle) ||
    basename(f.path).toLowerCase().includes(needle));
}

faces.sort((a, b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));

if (asJson) {
  console.log(JSON.stringify(faces, null, 2));
} else if (perFile) {
  for (const f of faces) console.log(`${f.family} — ${f.style}\n  ${f.path}`);
} else {
  const byFamily = new Map();
  for (const f of faces) {
    if (!byFamily.has(f.family)) byFamily.set(f.family, []);
    byFamily.get(f.family).push(f);
  }
  for (const [family, list] of byFamily) {
    console.log(`${family}  (${list.length})`);
    for (const f of list) console.log(`    ${f.style.padEnd(22)} ${f.path}`);
  }
  console.error(`\n${byFamily.size} families, ${faces.length} faces, scanned ${files.length} files.`);
  if (!faces.length) {
    console.error(`No fonts matched. Searched: ${FONT_DIRS.join(', ')}`);
    process.exitCode = 1;
  }
}
