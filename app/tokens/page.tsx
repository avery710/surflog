import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ApiTokens } from "@/components/api-tokens";
import { listApiTokens } from "@/lib/token-auth";

/** /tokens — the apps connected to the caller's journal (OAuth grants, plus any
 *  personal token made before those were removed), each revocable. */
export default async function TokensPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/tokens");

  return <ApiTokens initialTokens={await listApiTokens(session.user.id)} />;
}
