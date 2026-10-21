import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const PROD = "https://prod.example/api/health";
const STAG = "https://staging.example/api/health";
vi.mock("@/lib/health", () => ({
  HEALTH_CHECK_URLS: { production: "https://prod.example/api/health", staging: "https://staging.example/api/health" },
}));

import { GET } from "@/app/api/cron/keep-awake/route";

const fetchMock = vi.fn();

const call = (authorization?: string) =>
  GET(
    new NextRequest("http://localhost/api/cron/keep-awake", {
      headers: authorization ? { authorization } : {},
    }),
  );

const answer = (byUrl: Record<string, number | Error>) =>
  fetchMock.mockImplementation(async (url: string) => {
    const r = byUrl[url] ?? 200;
    if (r instanceof Error) throw r;
    return new Response(r === 200 ? '{"ok":true}' : "", { status: r });
  });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "");
  fetchMock.mockReset();
  answer({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/keep-awake", () => {
  it("is 401 without the cron secret, or with a wrong one, and calls nothing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 401 for everyone when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls production's and staging's health checks", async () => {
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ production: true, staging: true });
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([PROD, STAG].sort());
  });

  it("sends the protection bypass secret when the project has one", async () => {
    vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "bypass");
    await call("Bearer s3cret");
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers).toEqual({ "x-vercel-protection-bypass": "bypass" });
    }
  });

  it("is 502 when one answers an error, still calling the other", async () => {
    answer({ [STAG]: 503 });
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ production: true, staging: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't follow redirects: a login-wall 302 counts as down", async () => {
    answer({ [STAG]: 302 });
    const res = await call("Bearer s3cret");
    expect(await res.json()).toEqual({ production: true, staging: false });
    for (const [, init] of fetchMock.mock.calls) expect(init.redirect).toBe("manual");
  });

  it("needs the health check's own { ok: true }, not just any 200", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      new Response(url === STAG ? "<html>login</html>" : '{"ok":true}', { status: 200 }),
    );
    expect(await (await call("Bearer s3cret")).json()).toEqual({ production: true, staging: false });
  });

  it("is 502 when one can't be reached", async () => {
    answer({ [PROD]: new Error("timeout") });
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ production: false, staging: true });
  });
});
