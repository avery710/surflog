import { auth } from "@/auth";
import { getGoal, listBoards, listSessions, listSpotNotes } from "@/lib/db";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listSpots } from "@/lib/spot-store";
import { pendingAdminWork } from "@/lib/spot-edit-requests";
import { listAllRequests, listOwnRequests } from "@/lib/spot-requests";
import { googleSignIn } from "@/app/actions";
import { Journal } from "@/components/journal";
import { Landing } from "@/components/landing/landing";
import { getLandingSpots } from "@/lib/landing-spots";
import { hasConnectedApp } from "@/lib/token-auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ log?: string; spot?: string }> }) {
  const session = await auth();
  // Signed out → the landing page (proxy.ts lets exactly "/" through
  // without sign-in for this). It renders synthetic demo data only and
  // never touches lib/db.ts, so nothing private can leak through it.
  if (!session?.user?.id) {
    return (
      <Landing
        spots={await getLandingSpots()}
        signInAction={async () => {
          "use server";
          await googleSignIn("/");
        }}
      />
    );
  }

  const canManageSpots = isSpotAdmin(session.user);
  const [sessions, spotNotes, boards, goal, spots, requestRows, pendingSpotRequests, aiConnected] = await Promise.all([
    listSessions(session.user.id),
    listSpotNotes(session.user.id),
    listBoards(session.user.id),
    getGoal(session.user.id),
    // the whole spot catalogue (the static Taiwan copy until the `spots`
    // migration is applied) and the viewer's own spot requests
    listSpots(),
    listOwnRequests(session.user.id),
    // admin only: how many requests are waiting, for the menu badge
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
    // whether to show the "connect an AI app" card; on any failure assume
    // connected, so a database hiccup never nags someone who already is
    hasConnectedApp(session.user.id).catch(() => true),
  ]);

  // A user's own requests: the minimum needed to log against one — never
  // the requester snapshot, note or location.
  const requests = requestRows.map((r) => ({ id: r.id, name: r.name, status: r.status, spotSlug: r.spot_slug }));

  // No wrapping max-width div here any more — Journal's own flat
  // full-bleed header (2026-10-02) needs to render outside the content
  // column, so Journal applies that column itself to everything below
  // its header instead. See journal.tsx's own comment.
  return (
    <Journal initialSessions={sessions} initialSpotNotes={spotNotes} initialBoards={boards} initialGoal={goal} initialSpots={spots} initialRequests={requests} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} showAiAppCard={!aiConnected} user={session.user} openLogForm={(await searchParams).log === "1"} logSpot={(await searchParams).spot} />
  );
}
