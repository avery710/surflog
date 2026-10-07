import { redirect } from "next/navigation";

/** The page moved to /ai-apps (first /agents on 2026-10-07, then /ai-apps the
 *  same day). Kept so older links, and the consent page's "revoke under…"
 *  habit, still land in the right place. */
export default function TokensRedirect() {
  redirect("/ai-apps");
}
