import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSessions, listSpotNotes } from "@/lib/db";
import { Journal } from "@/components/journal";

export default async function Home() {
  const session = await auth();
  // Defense in depth — middleware.ts already redirects unauthenticated page
  // requests to /signin, but a route handler should never trust that alone.
  if (!session?.user?.id) redirect("/signin");

  const [sessions, spotNotes] = await Promise.all([
    listSessions(session.user.id),
    listSpotNotes(session.user.id),
  ]);

  return (
    <div className="mx-auto w-full max-w-[880px] flex-1 px-4.5 pb-18">
      <Journal initialSessions={sessions} initialSpotNotes={spotNotes} user={session.user} />
    </div>
  );
}
