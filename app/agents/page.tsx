import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiTokens } from "@/components/api-tokens";
import { SiteHeader } from "@/components/site-header";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listAllRequests } from "@/lib/spot-requests";
import { listApiTokens } from "@/lib/token-auth";

/** /agents — connect an agent to the caller's journal, and manage what is
 *  already connected (OAuth grants and personal tokens). */
export default async function TokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/agents");

  // The address users paste into their agent is this deployment's own, read
  // from the request (same rule as lib/oauth.ts originOf) — never hard-coded.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  // Same menu as on the journal: the admin link and its waiting count.
  const canManageSpots = isSpotAdmin(session.user);
  const [tokens, pendingSpotRequests] = await Promise.all([
    listApiTokens(session.user.id),
    canManageSpots ? listAllRequests().then((rows) => rows.filter((r) => r.status === "pending").length) : 0,
  ]);

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <ApiTokens initialTokens={tokens} mcpUrl={`${proto}://${host}/api/mcp`} />
    </>
  );
}
