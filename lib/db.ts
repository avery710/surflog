/**
 * Storage for sessions. Backed by data/sessions.json today — a JSON file,
 * read/written whole, with a lockless write queue so concurrent saves don't
 * interleave.
 *
 * THIS IS DEV-ONLY. On Vercel the filesystem is read-only outside /tmp and
 * nothing written there survives past the request (or across instances).
 * Before deploying, swap this module for a real database (Postgres via
 * Vercel Postgres/Neon/Supabase — see README) — every call site goes through
 * the functions below, so that's the only file that needs to change.
 *
 * Multi-user (2026-09-18): every session is scoped by `ownerId` (a Google
 * account's stable subject id — see auth.ts). The 3 real sessions that
 * predate login all carry the placeholder owner "legacy" — see
 * `claimLegacySessions` below for how those get adopted by whoever actually
 * owns them (Capy) without handing them to whichever friend happens to sign
 * in first.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Session } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "sessions.json");
const LEGACY_OWNER = "legacy";

interface Envelope {
  exportedAt: string;
  source: string;
  sessions: Session[];
}

// Serializes writes within this process. Doesn't help across multiple
// serverless instances — one more reason this is dev-only.
let writeQueue: Promise<unknown> = Promise.resolve();

function normalize(raw: unknown): Session {
  const s = raw as Partial<Session> & Record<string, unknown>;
  return {
    id: String(s.id ?? ""),
    ownerId: typeof s.ownerId === "string" && s.ownerId ? s.ownerId : LEGACY_OWNER,
    spot: String(s.spot ?? ""),
    when: String(s.when ?? ""),
    notesHtml: typeof s.notesHtml === "string" ? s.notesHtml : "",
    notes: typeof s.notes === "string" ? s.notes : "",
    photos: Array.isArray(s.photos) ? (s.photos as Session["photos"]) : [],
    cond: (s.cond as Session["cond"]) ?? null,
    condOpenMeteo: (s.condOpenMeteo as Session["condOpenMeteo"]) ?? null,
    rating: typeof s.rating === "number" ? s.rating : null,
    createdAt: String(s.createdAt ?? new Date().toISOString()),
    ...(s.example ? { example: true as const } : {}),
  };
}

async function readEnvelope(): Promise<Envelope> {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      exportedAt: parsed.exportedAt ?? new Date().toISOString(),
      source: parsed.source ?? "Surflog",
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalize) : [],
    };
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { exportedAt: new Date().toISOString(), source: "Surflog", sessions: [] };
    }
    throw e;
  }
}

async function writeEnvelope(env: Envelope): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(env, null, 2) + "\n", "utf-8");
  await fs.rename(tmp, FILE);
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.catch(() => {});
  return result;
}

/**
 * One-time adoption of the pre-login journal entries. Gated on the signed-in
 * user's email matching LEGACY_OWNER_EMAIL (set in .env — see README), so
 * ownership only ever transfers to whoever the deployment's owner actually
 * is, never to whichever friend happens to sign in first. Once claimed, the
 * env var stops mattering — the rows just belong to that account now.
 */
async function claimLegacySessions(ownerId: string, email: string | null | undefined): Promise<void> {
  const legacyOwnerEmail = process.env.LEGACY_OWNER_EMAIL;
  if (!legacyOwnerEmail || !email || email.toLowerCase() !== legacyOwnerEmail.toLowerCase()) return;

  await enqueue(async () => {
    const env = await readEnvelope();
    let claimed = false;
    for (const s of env.sessions) {
      if (s.ownerId === LEGACY_OWNER) {
        s.ownerId = ownerId;
        claimed = true;
      }
    }
    if (claimed) {
      env.exportedAt = new Date().toISOString();
      await writeEnvelope(env);
    }
  });
}

export async function listSessions(ownerId: string, email?: string | null): Promise<Session[]> {
  await claimLegacySessions(ownerId, email);
  const env = await readEnvelope();
  return env.sessions
    .filter((s) => s.ownerId === ownerId)
    .sort((a, b) => (b.when || "").localeCompare(a.when || ""));
}

/** Unscoped lookup — callers (API routes) must check `.ownerId` themselves. */
export async function getSession(id: string): Promise<Session | null> {
  const env = await readEnvelope();
  return env.sessions.find((s) => s.id === id) ?? null;
}

export async function createSession(session: Session): Promise<Session> {
  return enqueue(async () => {
    const env = await readEnvelope();
    env.sessions.push(session);
    env.exportedAt = new Date().toISOString();
    await writeEnvelope(env);
    return session;
  });
}

export async function updateSession(
  id: string,
  patch: Partial<Session>
): Promise<Session | null> {
  return enqueue(async () => {
    const env = await readEnvelope();
    const idx = env.sessions.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    // copy before mutating — see CLAUDE.md "Bugs already hit": frozen
    // snapshot objects have bitten this exact pattern before.
    const next = { ...env.sessions[idx], ...patch, id };
    env.sessions[idx] = next;
    env.exportedAt = new Date().toISOString();
    await writeEnvelope(env);
    return next;
  });
}

export async function deleteSession(id: string): Promise<boolean> {
  return enqueue(async () => {
    const env = await readEnvelope();
    const before = env.sessions.length;
    env.sessions = env.sessions.filter((s) => s.id !== id);
    if (env.sessions.length === before) return false;
    env.exportedAt = new Date().toISOString();
    await writeEnvelope(env);
    return true;
  });
}

export function newSessionId(): string {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  ).slice(0, 20);
}
