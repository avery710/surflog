import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/types";

// ---- a tiny in-memory stand-in for the Supabase query builder -------------
type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = { session_shares: [] };

function builder(table: string) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row = {};
  const filters: [string, unknown][] = [];
  const matches = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
  const run = (single: boolean) => {
    if (op === "insert") {
      const dup = (tables[table] ?? []).find((r) => r.session_id === payload.session_id || r.token === payload.token);
      if (dup) return { data: null, error: { code: "23505", message: "duplicate" } };
      const row = { created_at: "2026-10-08T00:00:00Z", ...payload };
      tables[table].push(row);
      return { data: row, error: null };
    }
    const rows = matches();
    if (op === "update") rows.forEach((r) => Object.assign(r, payload));
    if (op === "delete") tables[table] = tables[table].filter((r) => !rows.includes(r));
    return { data: single ? (rows[0] ?? null) : rows, error: null };
  };
  const api: Record<string, unknown> = {
    select: () => api,
    insert: (row: Row) => ((op = "insert"), (payload = row), api),
    update: (row: Row) => ((op = "update"), (payload = row), api),
    delete: () => ((op = "delete"), api),
    eq: (k: string, v: unknown) => (filters.push([k, v]), api),
    maybeSingle: async () => run(true),
    single: async () => run(true),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run(false)).then(res, rej),
  };
  return api;
}
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/db", () => ({ getSession: vi.fn(), getBoard: vi.fn() }));
vi.mock("@/lib/blob", () => ({ blobMeta: vi.fn() }));
vi.mock("@/lib/spot-store", () => ({ resolveSpot: vi.fn() }));
vi.mock("@/lib/spot-requests", () => ({ getRequest: vi.fn() }));

import { getBoard, getSession } from "@/lib/db";
import { blobMeta } from "@/lib/blob";
import { resolveSpot } from "@/lib/spot-store";
import {
  disableShare,
  enableShare,
  getShareStatus,
  loadPublicCard,
  loadPublicShare,
  newShareToken,
  ownedShareCard,
  sharedMediaMeta,
} from "@/lib/session-share";
import { toPublicShare } from "@/lib/share-public";
import { buildShareCard } from "@/lib/share-card-data";
import { fakeSession } from "@/app/dev/fixtures";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";

const ME = { id: "owner-me-sub-123456789", name: "Avery Lin", image: "https://lh3.googleusercontent.com/a/x" };
const OTHER = "owner-other-sub-987654321";
const SPOT = TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === "jialeshui")!;

const mine = (over: Partial<Session> = {}): Session =>
  fakeSession({
    id: "s1",
    ownerId: ME.id,
    photos: [{ id: "a".repeat(32), type: "image/jpeg" }, { id: "b".repeat(32), type: "video/mp4" }],
    boardId: "board-1",
    goalText: "SECRET GOAL TEXT",
    goalMet: true,
    goalPointsMet: [true],
    notesHtml: "<div>Glassy <b>morning</b></div><script>alert(1)</script>",
    notes: "Glassy morning",
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  tables.session_shares = [];
  vi.mocked(getSession).mockImplementation(async (id: string) => (id === "s1" ? mine() : id === "s-other" ? mine({ id: "s-other", ownerId: OTHER }) : null));
  vi.mocked(getBoard).mockResolvedValue({ id: "board-1", ownerId: ME.id, brand: "Pyzel Ghost", lengthIn: 74, note: "SECRET BOARD NOTE" } as never);
  vi.mocked(resolveSpot).mockResolvedValue(SPOT);
  vi.mocked(blobMeta).mockImplementation(async (id: string) =>
    id === "a".repeat(32) ? { mimeType: "image/jpeg", ownerId: ME.id } : id === "b".repeat(32) ? { mimeType: "video/mp4", ownerId: ME.id } : id === "c".repeat(32) ? { mimeType: "image/jpeg", ownerId: ME.id } : null
  );
});

describe("tokens", () => {
  it("are 32 random bytes as base64url and never repeat", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
  });
});

describe("owner management", () => {
  it("is private by default", async () => {
    expect(await getShareStatus(ME.id, "s1")).toEqual({ ok: true, data: null });
    expect(await loadPublicShare("x".repeat(43), "en")).toBeNull();
  });

  it("enabling creates a link; enabling again keeps the same token", async () => {
    const a = await enableShare(ME, "s1");
    expect(a.ok && a.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const b = await enableShare(ME, "s1");
    expect(b.ok && a.ok && b.data.token === a.data.token).toBe(true);
    expect(tables.session_shares).toHaveLength(1);
  });

  it("stores the owner's name and https avatar only", async () => {
    await enableShare({ id: ME.id, name: "  Avery Lin ", image: "javascript:alert(1)" }, "s1");
    expect(tables.session_shares[0]).toMatchObject({ owner_name: "Avery Lin", owner_image: null, owner_id: ME.id });
  });

  it("another user's session is not found for every action, and nothing is created", async () => {
    for (const r of [await getShareStatus(ME.id, "s-other"), await enableShare(ME, "s-other"), await disableShare(ME.id, "s-other"), await ownedShareCard(ME.id, "s-other", "en")]) {
      expect(r).toEqual({ ok: false, status: 404, error: "not found" });
    }
    expect(tables.session_shares).toHaveLength(0);
    // and a missing session answers identically
    expect(await enableShare(ME, "nope")).toEqual({ ok: false, status: 404, error: "not found" });
  });

  it("someone else cannot turn off my link", async () => {
    await enableShare(ME, "s1");
    expect(await disableShare(OTHER, "s1")).toEqual({ ok: false, status: 404, error: "not found" });
    expect(tables.session_shares).toHaveLength(1);
  });

  it("turning off makes the old link 404; turning on again mints a new token", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    expect(await loadPublicShare(on.data.token, "en")).not.toBeNull();
    expect(await disableShare(ME.id, "s1")).toEqual({ ok: true, data: true });
    expect(await loadPublicShare(on.data.token, "en")).toBeNull();
    expect(await loadPublicCard(on.data.token, "en")).toBeNull();
    expect(await sharedMediaMeta(on.data.token, "a".repeat(32))).toBeNull();
    const again = await enableShare(ME, "s1");
    expect(again.ok && again.data.token).not.toBe(on.data.token);
  });

  it("a race on the unique session id returns the winner's token", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    // simulate: the existence check misses (stale), the insert then collides
    const spy = vi.spyOn(tables.session_shares, "find");
    spy.mockReturnValueOnce(undefined);
    const second = await enableShare(ME, "s1");
    expect(second.ok && second.data.token).toBe(on.data.token);
    spy.mockRestore();
  });
});

describe("public side", () => {
  it("unknown, malformed and turned-off tokens are all just null", async () => {
    await enableShare(ME, "s1");
    for (const t of ["z".repeat(43), "short", "", "../../etc", "A".repeat(500)]) {
      expect(await loadPublicShare(t, "en")).toBeNull();
      expect(await loadPublicCard(t, "en")).toBeNull();
      expect(await sharedMediaMeta(t, "a".repeat(32))).toBeNull();
    }
  });

  it("returns the whitelisted view in the visitor's language", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    const auto = await loadPublicShare(on.data.token, "zh-TW");
    expect(auto?.lang).toBe("zh-TW");
    expect(auto?.spotName).toBe("佳樂水");
    const fixed = await loadPublicShare(on.data.token, "en");
    expect(fixed?.lang).toBe("en");
    expect(fixed?.spotName).toBe("Jialeshui");
    expect(fixed?.owner).toEqual({ name: "Avery Lin", image: "https://lh3.googleusercontent.com/a/x" });
    expect(fixed?.boardName).toBe(`Pyzel Ghost 6'2"`);
    expect(fixed?.media).toEqual([{ id: "a".repeat(32), type: "image/jpeg" }, { id: "b".repeat(32), type: "video/mp4" }]);
  });

  it("notes are re-sanitized: no script tags or attributes survive", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    const v = await loadPublicShare(on.data.token, "en");
    expect(v?.notesHtml).not.toMatch(/<script|onerror|onclick/i);
    expect(v?.notesHtml).toContain("<b>morning</b>");
  });

  it("a session whose owner no longer matches the share row is not served", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    vi.mocked(getSession).mockResolvedValue(mine({ ownerId: OTHER }));
    expect(await loadPublicShare(on.data.token, "en")).toBeNull();
    expect(await sharedMediaMeta(on.data.token, "a".repeat(32))).toBeNull();
  });

  it("does not leak a private field", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    const view = await loadPublicShare(on.data.token, "en");
    const json = JSON.stringify(view);
    for (const secret of [
      ME.id, // the Google sub / ownerId
      "ownerId",
      "owner_id",
      "SECRET GOAL TEXT",
      "goal",
      "SECRET BOARD NOTE",
      "board-1",
      on.data.token, // the token itself is not echoed back
      "dev-share", // session id
      "s1",
      "gridLat", // raw condition blobs
      "fetchedAt",
      "stationTownship",
      "createdAt",
      "email",
    ]) {
      expect(json, `public view leaked "${secret}"`).not.toContain(secret);
    }
    // the shape itself is exactly the allow-list
    expect(Object.keys(view!).sort()).toEqual(["boardName", "lang", "media", "notesHtml", "notesText", "owner", "spotName", "tiles", "whenLabel"]);
    expect(Object.keys(view!.owner).sort()).toEqual(["image", "name"]);
    for (const t of view!.tiles) expect(Object.keys(t).filter((k) => t[k as keyof typeof t] !== undefined).sort()).toEqual(expect.arrayContaining(["key", "label", "lines", "value"]));
  });

  it("toPublicShare never spreads the session, even one with extra private fields", () => {
    const s = { ...mine(), email: "me@example.com", spotNotes: "private", token: "tok" } as unknown as Session;
    const card = buildShareCard({ session: s, spot: SPOT, spotName: "Jialeshui", board: null, lang: "en" });
    const json = JSON.stringify(toPublicShare(s, card, { owner_name: null, owner_image: null }));
    for (const secret of [ME.id, "me@example.com", "private", "tok", "SECRET GOAL TEXT"]) expect(json).not.toContain(secret);
  });

  it("the board must belong to the session's owner", async () => {
    vi.mocked(getBoard).mockResolvedValue({ id: "board-1", ownerId: OTHER, brand: "Not Mine", lengthIn: 70 } as never);
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    expect((await loadPublicShare(on.data.token, "en"))?.boardName).toBeNull();
  });
});

describe("shared media", () => {
  it("serves only blobs that belong to the shared session", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    expect(await sharedMediaMeta(on.data.token, "a".repeat(32))).toEqual({ mimeType: "image/jpeg" });
    expect(await sharedMediaMeta(on.data.token, "b".repeat(32))).toEqual({ mimeType: "video/mp4" });
    // exists and is the owner's, but is not attached to this session (another session / a board photo)
    expect(await sharedMediaMeta(on.data.token, "c".repeat(32))).toBeNull();
    // does not exist
    expect(await sharedMediaMeta(on.data.token, "d".repeat(32))).toBeNull();
  });

  it("refuses a blob whose recorded owner is not the share's owner", async () => {
    const on = await enableShare(ME, "s1");
    if (!on.ok) throw new Error("setup");
    vi.mocked(blobMeta).mockResolvedValue({ mimeType: "image/jpeg", ownerId: OTHER });
    expect(await sharedMediaMeta(on.data.token, "a".repeat(32))).toBeNull();
  });

  it("another session's token cannot read this session's media", async () => {
    vi.mocked(getSession).mockImplementation(async (id: string) =>
      id === "s1" ? mine() : id === "s2" ? mine({ id: "s2", photos: [{ id: "c".repeat(32), type: "image/jpeg" }] }) : null
    );
    const t1 = await enableShare(ME, "s1");
    const t2 = await enableShare(ME, "s2");
    if (!t1.ok || !t2.ok) throw new Error("setup");
    expect(await sharedMediaMeta(t2.data.token, "a".repeat(32))).toBeNull();
    expect(await sharedMediaMeta(t1.data.token, "c".repeat(32))).toBeNull();
    expect(await sharedMediaMeta(t2.data.token, "c".repeat(32))).toEqual({ mimeType: "image/jpeg" });
  });
});
