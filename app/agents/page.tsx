import { redirect } from "next/navigation";

/** The page moved to /ai-apps (2026-10-07, renamed from /agents — "agent"
 *  overclaimed for the chat-app tiles). Kept so old links still land in the
 *  right place. */
export default function AgentsRedirect() {
  redirect("/ai-apps");
}
