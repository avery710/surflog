import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/types";

vi.mock("@/lib/db", () => ({
  getSession: vi.fn(),
  createSession: vi.fn(async (s: Session) => s),
  updateSession: vi.fn(async (id: string, patch: Partial<Session>) => ({ id, ...patch })),
  deleteSession: vi.fn(async () => true),
  newSessionId: () => "new-id",
}));
vi.mock("@/lib/blob", () => ({ deleteBlob: vi.fn(async () => undefined) }));
vi.mock("@/lib/spot-store", () => ({ resolveSpot: vi.fn() }));
vi.mock("@/lib/spot-access", () => ({ checkRequestSpot: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/openmeteo", () => ({ getConditions: vi.fn() }));
vi.mock("@/lib/cwa-tide", () => ({ getTide: vi.fn() }));
vi.mock("@/lib/board-access", () => ({ resolveOwnedBoardId: vi.fn() }));

import { createSession, deleteSession, getSession, updateSession } from "@/lib/db";
import { deleteBlob } from "@/lib/blob";
import { resolveSpot } from "@/lib/spot-store";
import { checkRequestSpot } from "@/lib/spot-access";
import { getConditions } from "@/lib/openmeteo";
import { getTide } from "@/lib/cwa-tide";
import { resolveOwnedBoardId } from "@/lib/board-access";
import { createSessionFor, deleteSessionFor, updateSessionFor } from "@/lib/session-service";

const ME = "owner-me";
const OTHER = "owner-other";
const WAIAO = { slug: "waiao", lat: 24.87, lng: 121.84, timezone: "Asia/Taipei", tideTownship: "宜蘭縣頭城鎮" };
const OM = { swellHeightM: 1, source: "open-meteo" };
const TIDE = { tideM: 1, source: "cwa" };

const stored = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    ownerId: ME,
    spot: "waiao",
    when: "2026-10-05T08:00",
    notesHtml: "",
    notes: "",
    photos: [],
    cond: null,
    condOpenMeteo: null,
    condCwaTide: null,
    createdAt: "2026-10-05T00:00:00.000Z",
    ...over,
  }) as Session;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSpot).mockResolvedValue(WAIAO as never);
  vi.mocked(getConditions).mockResolvedValue(OM as never);
  vi.mocked(getTide).mockResolvedValue(TIDE as never);
  vi.mocked(checkRequestSpot).mockResolvedValue({ ok: true });
  vi.mocked(resolveOwnedBoardId).mockResolvedValue({ ok: true, boardId: undefined });
});

describe("createSessionFor", () => {
  it("saves under the caller's owner id with conditions filled in", async () => {
    const r = await createSessionFor(ME, { spot: " waiao ", when: "2026-10-05T08:00", notesHtml: "<div>hi</div>" });
    expect(r.ok).toBe(true);
    const saved = vi.mocked(createSession).mock.calls[0][0];
    expect(saved).toMatchObject({ ownerId: ME, spot: "waiao", notes: "hi", condOpenMeteo: OM, condCwaTide: TIDE });
    expect(getConditions).toHaveBeenCalledWith(WAIAO.lat, WAIAO.lng, "2026-10-05T08:00", "Asia/Taipei");
  });

  it("ignores an ownerId smuggled into the body", async () => {
    await createSessionFor(ME, { spot: "waiao", when: "2026-10-05T08:00", ownerId: OTHER, id: "chosen" });
    expect(vi.mocked(createSession).mock.calls[0][0]).toMatchObject({ ownerId: ME, id: "new-id" });
  });

  it.each([
    [null, "invalid JSON body"],
    ["text", "invalid JSON body"],
    [{ when: "2026-10-05T08:00" }, "spot and when"],
    [{ spot: "waiao", when: "2026-10-05 08:00" }, "spot and when"],
    [{ spot: "waiao", when: "2026-10-05T08:00", goalAchieved: "nope" }, "invalid goalAchieved"],
  ])("rejects %j with 400", async (body, message) => {
    const r = await createSessionFor(ME, body);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(!r.ok && r.error).toContain(message);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("404s a spot request that isn't the caller's", async () => {
    vi.mocked(checkRequestSpot).mockResolvedValue({ ok: false });
    expect(await createSessionFor(ME, { spot: "req:x", when: "2026-10-05T08:00" })).toMatchObject({ status: 404 });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("404s a board the caller doesn't own", async () => {
    vi.mocked(resolveOwnedBoardId).mockResolvedValue({ ok: false });
    const r = await createSessionFor(ME, { spot: "waiao", when: "2026-10-05T08:00", boardId: "b" });
    expect(r).toMatchObject({ ok: false, status: 404, error: "board not found" });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("still saves when the condition sources are down", async () => {
    vi.mocked(getConditions).mockRejectedValue(new Error("down"));
    vi.mocked(getTide).mockRejectedValue(new Error("down"));
    const r = await createSessionFor(ME, { spot: "waiao", when: "2026-10-05T08:00" });
    expect(r.ok).toBe(true);
    expect(vi.mocked(createSession).mock.calls[0][0]).toMatchObject({ condOpenMeteo: null, condCwaTide: null });
  });

  it("fetches nothing for a spot without coordinates", async () => {
    vi.mocked(resolveSpot).mockResolvedValue(undefined);
    await createSessionFor(ME, { spot: "req:mine", when: "2026-10-05T08:00" });
    expect(getConditions).not.toHaveBeenCalled();
    expect(getTide).not.toHaveBeenCalled();
  });
});

describe("updateSessionFor", () => {
  it("is 'not found' for someone else's session, and writes nothing", async () => {
    vi.mocked(getSession).mockResolvedValue(stored({ ownerId: OTHER }));
    expect(await updateSessionFor(ME, "s1", { notesHtml: "x" })).toEqual({ ok: false, status: 404, error: "not found" });
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("is the same 'not found' for an id that doesn't exist", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    expect(await updateSessionFor(ME, "nope", { notesHtml: "x" })).toEqual({ ok: false, status: 404, error: "not found" });
  });

  it("changes notes without refetching conditions", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    await updateSessionFor(ME, "s1", { notesHtml: "<div>R&amp;D</div>" });
    expect(updateSession).toHaveBeenCalledWith("s1", { notesHtml: "<div>R&amp;D</div>", notes: "R&D" });
    expect(getConditions).not.toHaveBeenCalled();
  });

  it("refetches conditions when the time changes", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    await updateSessionFor(ME, "s1", { when: "2026-10-06T10:00" });
    expect(getConditions).toHaveBeenCalledWith(WAIAO.lat, WAIAO.lng, "2026-10-06T10:00", "Asia/Taipei");
    expect(vi.mocked(updateSession).mock.calls[0][1]).toMatchObject({ condOpenMeteo: OM, condCwaTide: TIDE });
  });

  it("doesn't refetch when spot and time are sent unchanged", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    await updateSessionFor(ME, "s1", { spot: "waiao", when: "2026-10-05T08:00" });
    expect(getConditions).not.toHaveBeenCalled();
  });

  it("refetches on refreshConditions", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    await updateSessionFor(ME, "s1", { refreshConditions: true });
    expect(getConditions).toHaveBeenCalledTimes(1);
  });

  it("clears conditions when moved to a spot with no coordinates", async () => {
    vi.mocked(getSession).mockResolvedValue(stored({ condOpenMeteo: OM as never }));
    vi.mocked(resolveSpot).mockResolvedValue(undefined);
    await updateSessionFor(ME, "s1", { spot: "req:mine" });
    expect(vi.mocked(updateSession).mock.calls[0][1]).toMatchObject({ condOpenMeteo: null, condCwaTide: null });
  });

  it("keeps the old conditions when a refetch fails", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    vi.mocked(getConditions).mockRejectedValue(new Error("down"));
    await updateSessionFor(ME, "s1", { when: "2026-10-06T10:00" });
    expect(vi.mocked(updateSession).mock.calls[0][1]).not.toHaveProperty("condOpenMeteo");
  });

  it("can't change the owner or id through the body", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    await updateSessionFor(ME, "s1", { ownerId: OTHER, id: "x", photos: [] });
    expect(updateSession).toHaveBeenCalledWith("s1", {});
  });

  it("404s a foreign board and writes nothing", async () => {
    vi.mocked(getSession).mockResolvedValue(stored());
    vi.mocked(resolveOwnedBoardId).mockResolvedValue({ ok: false });
    expect(await updateSessionFor(ME, "s1", { boardId: "theirs" })).toMatchObject({ status: 404 });
    expect(updateSession).not.toHaveBeenCalled();
  });
});

describe("deleteSessionFor", () => {
  it("is 'not found' for someone else's session, and deletes nothing", async () => {
    vi.mocked(getSession).mockResolvedValue(stored({ ownerId: OTHER, photos: [{ id: "p1", type: "image/jpeg" }] }));
    expect(await deleteSessionFor(ME, "s1")).toEqual({ ok: false, status: 404, error: "not found" });
    expect(deleteSession).not.toHaveBeenCalled();
    expect(deleteBlob).not.toHaveBeenCalled();
  });

  it("deletes the session and frees its media", async () => {
    vi.mocked(getSession).mockResolvedValue(
      stored({ photos: [{ id: "p1", type: "image/jpeg" }, { id: "v1", type: "video/mp4" }] })
    );
    expect(await deleteSessionFor(ME, "s1")).toEqual({ ok: true, data: true });
    expect(vi.mocked(deleteBlob).mock.calls.map((c) => c[0])).toEqual(["p1", "v1"]);
    expect(deleteSession).toHaveBeenCalledWith("s1");
  });

  it("still deletes the session when freeing media fails", async () => {
    vi.mocked(getSession).mockResolvedValue(stored({ photos: [{ id: "p1", type: "image/jpeg" }] }));
    vi.mocked(deleteBlob).mockRejectedValue(new Error("storage down"));
    expect(await deleteSessionFor(ME, "s1")).toEqual({ ok: true, data: true });
  });
});
