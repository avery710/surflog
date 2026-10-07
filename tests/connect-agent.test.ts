import { describe, expect, it, vi } from "vitest";

// The component file is a client module; only its pure matcher is under test.
vi.mock("sonner", () => ({ toast: {} }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/lib/i18n", () => ({ useLang: () => ({ t: (k: string) => k, lang: "en" }) }));

import { connectionMatches, uniqueName } from "@/components/connect-agent";
import type { ApiToken } from "@/lib/token-auth";

const tk = (over: Partial<ApiToken>): ApiToken => ({
  id: "1",
  name: "x",
  scope: "write",
  createdAt: "2026-10-07T00:00:00Z",
  lastUsedAt: null,
  revokedAt: null,
  kind: "app",
  host: null,
  ...over,
});

describe("connectionMatches", () => {
  const claude = tk({ name: "Claude", host: "claude.ai" });
  const code = tk({ name: "Claude Code (surflog)", host: "localhost:55490" });
  const cursor = tk({ name: "Cursor", kind: "personal" });

  it("tells the claude.ai connector and Claude Code apart", () => {
    expect(connectionMatches("claude", claude)).toBe(true);
    expect(connectionMatches("claude", code)).toBe(false);
    expect(connectionMatches("claude-code", code)).toBe(true);
    expect(connectionMatches("claude-code", claude)).toBe(false);
  });
  it("matches a Cursor token, ChatGPT and Gemini by host", () => {
    expect(connectionMatches("cursor", cursor)).toBe(true);
    expect(connectionMatches("chatgpt", tk({ name: "ChatGPT", host: "chatgpt.com" }))).toBe(true);
    expect(connectionMatches("gemini", tk({ name: "whatever", host: "oauth-redirect.googleusercontent.com" }))).toBe(true);
  });
  it("never matches a revoked connection or the catch-all tile", () => {
    expect(connectionMatches("claude", { ...claude, revokedAt: "2026-10-07T01:00:00Z" })).toBe(false);
    expect(connectionMatches("other", claude)).toBe(false);
  });
  it("is not fooled by a name alone for claude.ai", () => {
    expect(connectionMatches("claude", tk({ name: "Claude", host: "evil.example" }))).toBe(false);
  });
});

describe("uniqueName", () => {
  it("keeps a free name and numbers a taken one", () => {
    expect(uniqueName("n8n", [])).toBe("n8n");
    expect(uniqueName("n8n", [tk({ name: "n8n" })])).toBe("n8n 2");
    expect(uniqueName("n8n", [tk({ name: "n8n" }), tk({ id: "2", name: "n8n 2" })])).toBe("n8n 3");
  });
  it("lets a revoked connection's name be used again", () => {
    expect(uniqueName("Cursor", [tk({ name: "Cursor", revokedAt: "2026-10-07T01:00:00Z" })])).toBe("Cursor");
  });
});
