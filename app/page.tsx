import { auth } from "@/auth";
import { getGoal, listBoards, listSessions, listSpotNotes } from "@/lib/db";
import { googleSignIn } from "@/app/actions";
import { Journal } from "@/components/journal";
import { Landing } from "@/components/landing/landing";

export default async function Home() {
  const session = await auth();
  // Signed out → the landing page (proxy.ts lets exactly "/" through
  // without sign-in for this). It renders synthetic demo data only and
  // never touches lib/db.ts, so nothing private can leak through it.
  if (!session?.user?.id) {
    return (
      <Landing
        signInAction={async () => {
          "use server";
          await googleSignIn("/");
        }}
      />
    );
  }

  const [sessions, spotNotes, boards, goal] = await Promise.all([
    listSessions(session.user.id),
    listSpotNotes(session.user.id),
    listBoards(session.user.id),
    getGoal(session.user.id),
  ]);

  // No wrapping max-width div here any more — Journal's own flat
  // full-bleed header (2026-10-02) needs to render outside the content
  // column, so Journal applies that column itself to everything below
  // its header instead. See journal.tsx's own comment.
  return (
    <Journal initialSessions={sessions} initialSpotNotes={spotNotes} initialBoards={boards} initialGoal={goal} user={session.user} />
  );
}
