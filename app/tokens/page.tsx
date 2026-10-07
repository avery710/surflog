import { redirect } from "next/navigation";

/** The page moved to /agents (2026-10-07). Kept so older links, and the
 *  consent page's "revoke under…" habit, still land in the right place. */
export default function TokensRedirect() {
  redirect("/agents");
}
