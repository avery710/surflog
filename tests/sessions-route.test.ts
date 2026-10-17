import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const auth = vi.fn();
const countSessions = vi.fn();
const listSessionsPage = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  countSessions: (...a: unknown[]) => countSessions(...a),
  listSessionsPage: (...a: unknown[]) => listSessionsPage(...a),
}));
vi.mock("@/lib/session-service", () => ({ createSessionFor: vi.fn() }));

import { GET } from "@/app/api/sessions/route";

const get = (qs = "") => GET(new NextRequest(`http://localhost/api/sessions${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "owner-1" } });
  countSessions.mockResolvedValue(23);
  listSessionsPage.mockResolvedValue([{ id: "a" }]);
});

describe("GET /api/sessions", () => {
  it("is 401 without a session and never touches the database", async () => {
    auth.mockResolvedValue(null);
    expect((await get()).status).toBe(401);
    expect(countSessions).not.toHaveBeenCalled();
  });

  it("asks the database for 10 rows of the caller's own sessions", async () => {
    const body = await (await get("?page=2")).json();
    expect(listSessionsPage).toHaveBeenCalledWith("owner-1", 2, 10, {});
    expect(body).toMatchObject({ page: 2, pageSize: 10, total: 23, sessions: [{ id: "a" }] });
  });

  it("defaults to page 1 and clamps a page past the end", async () => {
    await get();
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 1, 10, {});
    await get("?page=99");
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 3, 10, {});
    await get("?page=abc");
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 1, 10, {});
  });

  it("caps pageSize and allows 1 for the latest session", async () => {
    await get("?pageSize=1");
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 1, 1, {});
    await get("?pageSize=100000");
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 1, 50, {});
  });

  it("passes a parsed filter to both queries and drops bad values", async () => {
    await get("?spot=jialeshui&board=none&from=2026-09-01&to=nope");
    const filter = { spot: "jialeshui", board: "none", from: "2026-09-01" };
    expect(countSessions).toHaveBeenLastCalledWith("owner-1", filter);
    expect(listSessionsPage).toHaveBeenLastCalledWith("owner-1", 1, 10, filter);
  });

  it("returns no rows, and runs no page query, for an owner with nothing logged", async () => {
    countSessions.mockResolvedValue(0);
    const body = await (await get("?page=3")).json();
    expect(listSessionsPage).not.toHaveBeenCalled();
    expect(body).toMatchObject({ page: 1, total: 0, sessions: [] });
  });
});
