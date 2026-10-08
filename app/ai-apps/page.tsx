import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiTokens } from "@/components/api-tokens";
import { SiteHeader } from "@/components/site-header";
import { isSpotAdmin } from "@/lib/spot-admin";
import { pendingAdminWork } from "@/lib/spot-edit-requests";
import { listAllRequests } from "@/lib/spot-requests";
import { listApiTokens } from "@/lib/token-auth";

/** /ai-apps — connect an AI app (chat assistants, coding tools, anything
 *  else) to the caller's journal, and manage what is already connected
 *  (OAuth grants and personal tokens). Was /agents until 2026-10-07 — "agent"
 *  overclaimed for the chat-app tiles (Claude/ChatGPT/Gemini), which only
 *  call these tools when asked in a conversation, unlike an actually
 *  autonomous coding agent. */
export default async function AiAppsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/ai-apps");

  // The address users paste into their AI app is this deployment's own, read
  // from the request (same rule as lib/oauth.ts originOf) — never hard-coded.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  // Same menu as on the journal: the admin link and its waiting count.
  const canManageSpots = isSpotAdmin(session.user);
  const [tokens, pendingSpotRequests] = await Promise.all([
    listApiTokens(session.user.id),
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
  ]);

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <ApiTokens initialTokens={tokens} mcpUrl={`${proto}://${host}/api/mcp`} />
    </>
  );
}
