import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiTokens } from "@/components/api-tokens";
import { listApiTokens } from "@/lib/token-auth";

/** /tokens — connect an agent to the caller's journal, and manage what is
 *  already connected (OAuth grants and personal tokens). */
export default async function TokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/tokens");

  // The address users paste into their agent is this deployment's own, read
  // from the request (same rule as lib/oauth.ts originOf) — never hard-coded.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return <ApiTokens initialTokens={await listApiTokens(session.user.id)} mcpUrl={`${proto}://${host}/api/mcp`} />;
}
