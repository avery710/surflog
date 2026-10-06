import { describe, expect, it, vi } from "vitest";

// Any database access in these cases is a bug: malformed credentials must be
// turned away before a lookup.
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => {
    throw new Error("database touched");
  },
}));

import { authenticateBearer, hashToken, parseTokenScope } from "@/lib/token-auth";

describe("authenticateBearer", () => {
  it.each([null, undefined, "", "Bearer", "Bearer ", "Basic abc", "sfl_abc", "Bearer abc", "Bearer sfl_a b"])(
    "rejects %j without a lookup",
    async (header) => {
      expect(await authenticateBearer(header)).toBeNull();
    }
  );
});

describe("hashToken", () => {
  it("is SHA-256 hex, and never the token itself", () => {
    const h = hashToken("sfl_example");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashToken("sfl_example"));
    expect(h).not.toBe(hashToken("sfl_examplf"));
  });
});

describe("parseTokenScope", () => {
  it("accepts only read and write", () => {
    expect(parseTokenScope("read")).toBe("read");
    expect(parseTokenScope("write")).toBe("write");
    expect(parseTokenScope("admin")).toBeNull();
    expect(parseTokenScope(undefined)).toBeNull();
  });
});
