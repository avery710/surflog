import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiTokens } from "@/components/api-tokens";
import { listApiTokens } from "@/lib/token-auth";

/** /tokens — create and revoke the caller's personal access tokens. */
export default async function TokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/tokens");

  return <ApiTokens initialTokens={await listApiTokens(session.user.id)} />;
}
