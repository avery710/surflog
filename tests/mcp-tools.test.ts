import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Session } from "@/lib/types";

vi.mock("@/lib/db", () => ({ getSession: vi.fn(), listSessions: vi.fn(), listBoards: vi.fn(async () => []) }));
vi.mock("@/lib/spot-store", () => ({
  listSpots: vi.fn(async () => [
    { slug: "waiao", name: "Wai'ao", nameZh: "外澳", country: "Taiwan", area: "Northeast", timezone: "Asia/Taipei" },
    { slug: "cloud-9", name: "Cloud 9", country: "Philippines", area: "Siargao", timezone: "Asia/Manila" },
  ]),
}));
vi.mock("@/lib/session-service", () => ({
  createSessionFor: vi.fn(),
  updateSessionFor: vi.fn(),
  deleteSessionFor: vi.fn(),
}));

import { getSession, listSessions } from "@/lib/db";
import { createSessionFor, deleteSessionFor, updateSessionFor } from "@/lib/session-service";
import { registerSurflogTools } from "@/lib/mcp-tools";
import { MCP_WRITES, resetRateLimits } from "@/lib/rate-limit";

type Result = { content: { text: string }[]; isError?: boolean };
type Tool = {
  config: { inputSchema: { safeParse: (v: unknown) => { success: boolean } }; annotations?: Record<string, unknown> };
  cb: (args: Record<string, unknown>) => Promise<Result>;
};

function tools(scope: "read" | "write", ownerId = "me") {
  const map = new Map<string, Tool>();
  const server = { registerTool: (name: string, config: Tool["config"], cb: Tool["cb"]) => map.set(name, { config, cb }) };
  registerSurflogTools(server as unknown as McpServer, { ownerId, scope, tokenId: "t" });
  return map;
}

const session = (over: Partial<Session>): Session =>
  ({
    id: "s1",
    ownerId: "me",
    spot: "waiao",
    when: "2026-10-05T08:00",
    notesHtml: "",
    notes: "secret",
    photos: [],
    cond: null,
    condOpenMeteo: null,
    condCwaTide: null,
    createdAt: "",
    ...over,
  }) as Session;

const body = (r: Result) => JSON.parse(r.content[0].text);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimits();
});

describe("which tools a token gets", () => {
  it("read-only: no write tools at all", () => {
    expect([...tools("read").keys()]).toEqual(["list_sessions", "get_session", "list_spots", "list_boards"]);
  });

  it("write: read tools plus create/update/delete", () => {
    expect([...tools("write").keys()]).toEqual([
      "list_sessions", "get_session", "list_spots", "list_boards",
      "create_session", "update_session", "delete_session",
    ]);
  });

  it("marks read tools read-only and delete destructive", () => {
    const t = tools("write");
    expect(t.get("list_sessions")!.config.annotations).toMatchObject({ readOnlyHint: true });
    expect(t.get("delete_session")!.config.annotations).toMatchObject({ destructiveHint: true });
  });
});

describe("get_session", () => {
  it("answers 'not found' for another owner's session and leaks nothing", async () => {
    vi.mocked(getSession).mockResolvedValue(session({ ownerId: "someone-else" }));
    const r = await tools("read").get("get_session")!.cb({ id: "s1" });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toBe("not found");
  });

  it("returns the caller's own session with the tide reading", async () => {
    vi.mocked(getSession).mockResolvedValue(
      session({
        condOpenMeteo: { tideEvents: [{ type: "low", time: "2026-10-05T06:00", heightM: 0.2 }, { type: "high", time: "2026-10-05T12:10", heightM: 1.1 }] } as never,
      })
    );
    const out = body(await tools("read").get("get_session")!.cb({ id: "s1" }));
    expect(out).toMatchObject({ id: "s1", spotName: "Wai'ao", notes: "secret" });
    expect(out.tide).toMatchObject({ trend: "rising", source: "open-meteo", next: { time: "2026-10-05T12:10" } });
    expect(out).not.toHaveProperty("ownerId");
  });
});

describe("list_sessions", () => {
  it("asks only for the token owner's sessions, newest first, filtered", async () => {
    vi.mocked(listSessions).mockResolvedValue([
      session({ id: "old", when: "2026-09-01T08:00" }),
      session({ id: "new", when: "2026-10-05T08:00" }),
      session({ id: "elsewhere", when: "2026-10-04T08:00", spot: "cloud-9" }),
    ]);
    const out = body(await tools("read", "me").get("list_sessions")!.cb({ spot: "waiao", from: "2026-08-01" }));
    expect(listSessions).toHaveBeenCalledWith("me");
    expect(out.sessions.map((s: { id: string }) => s.id)).toEqual(["new", "old"]);
  });

  it("caps the page and reports the real total", async () => {
    vi.mocked(listSessions).mockResolvedValue(Array.from({ length: 30 }, (_, i) => session({ id: `s${i}` })));
    const out = body(await tools("read").get("list_sessions")!.cb({}));
    expect(out).toMatchObject({ total: 30, returned: 20 });
  });
});

describe("create_session input", () => {
  const parse = (v: unknown) => tools("write").get("create_session")!.config.inputSchema.safeParse(v).success;

  it("takes even hours on the hour only", () => {
    expect(parse({ spot: "waiao", when: "2026-10-05T08:00" })).toBe(true);
    expect(parse({ spot: "waiao", when: "2026-10-05T22:00" })).toBe(true);
    expect(parse({ spot: "waiao", when: "2026-10-05T07:00" })).toBe(false);
    expect(parse({ spot: "waiao", when: "2026-10-05T08:30" })).toBe(false);
    expect(parse({ spot: "waiao", when: "2026-10-05T24:00" })).toBe(false);
    expect(parse({ spot: "waiao" })).toBe(false);
  });

  it("refuses a spot that isn't in the catalogue, without saving", async () => {
    const r = await tools("write").get("create_session")!.cb({ spot: "req:abc", when: "2026-10-05T08:00" });
    expect(r.isError).toBe(true);
    expect(createSessionFor).not.toHaveBeenCalled();
  });

  it("passes the owner and escaped notes to the service", async () => {
    vi.mocked(createSessionFor).mockResolvedValue({ ok: true, data: session({}) });
    await tools("write", "me").get("create_session")!.cb({ spot: "waiao", when: "2026-10-05T08:00", notes: "a <b>\nb" });
    expect(createSessionFor).toHaveBeenCalledWith("me", {
      spot: "waiao",
      when: "2026-10-05T08:00",
      notesHtml: "a &lt;b&gt;<br>b",
    });
  });
});

describe("update_session / delete_session", () => {
  it("sends only the fields that were given", async () => {
    vi.mocked(updateSessionFor).mockResolvedValue({ ok: true, data: session({}) });
    await tools("write", "me").get("update_session")!.cb({ id: "s1", boardId: null });
    expect(updateSessionFor).toHaveBeenCalledWith("me", "s1", { boardId: null });
  });

  it("surfaces the service's 'not found'", async () => {
    vi.mocked(deleteSessionFor).mockResolvedValue({ ok: false, status: 404, error: "not found" });
    const r = await tools("write").get("delete_session")!.cb({ id: "theirs" });
    expect(r).toMatchObject({ isError: true, content: [{ text: "not found" }] });
  });
});

describe("write rate limit", () => {
  it("refuses changes past the limit, per owner, and leaves reads alone", async () => {
    vi.mocked(deleteSessionFor).mockResolvedValue({ ok: true, data: true });
    vi.mocked(listSessions).mockResolvedValue([]);
    const mine = tools("write", "me");
    for (let i = 0; i < MCP_WRITES.limit; i++) expect((await mine.get("delete_session")!.cb({ id: "x" })).isError).toBeUndefined();

    const refused = await mine.get("delete_session")!.cb({ id: "x" });
    expect(refused.isError).toBe(true);
    expect(refused.content[0].text).toContain("rate limit");
    expect(deleteSessionFor).toHaveBeenCalledTimes(MCP_WRITES.limit);

    expect((await mine.get("list_sessions")!.cb({})).isError).toBeUndefined();
    expect((await tools("write", "other").get("delete_session")!.cb({ id: "x" })).isError).toBeUndefined();
  });
});
