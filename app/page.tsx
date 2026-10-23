import { Suspense } from "react";
import { auth } from "@/auth";
import { getGoal, listBoards, listSessionsPage, listSessionStats, listSpotNotes } from "@/lib/db";
import { PAGE_SIZE } from "@/lib/pagination";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listSpots } from "@/lib/spot-store";
import { pendingAdminWork } from "@/lib/spot-edit-requests";
import { listAllRequests, listOwnRequests } from "@/lib/spot-requests";
import { googleSignIn } from "@/app/actions";
import { Journal } from "@/components/journal";
import { Landing } from "@/components/landing/landing";
import { PageSkeleton } from "@/components/page-skeleton";
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

  // The journal streams in behind a skeleton (components/page-skeleton.tsx),
  // so a click on "/" changes the screen as soon as this shell arrives. Not a
  // loading.tsx: that would also cover the landing and every route under "/".
  return (
    <Suspense fallback={<PageSkeleton variant="journal" user={session.user} />}>
      <SignedInJournal userId={session.user.id} user={session.user} searchParams={searchParams} />
    </Suspense>
  );
}

async function SignedInJournal({
  userId,
  user,
  searchParams,
}: {
  userId: string;
  user: { id?: string; name?: string | null; email?: string | null; image?: string | null };
  searchParams: Promise<{ log?: string; spot?: string }>;
}) {
  const canManageSpots = isSpotAdmin(user);
  // Sessions are paged by the database: the slim list of all of them (small,
  // for the dashboard) plus the first 10 in full; the rest load on scroll
  // from GET /api/sessions. Every query starts at once: one round trip to
  // Supabase, not two (2026-10-21; the first page used to wait for the stats).
  const [query, stats, sessions, spotNotes, boards, goal, spots, requestRows, pendingSpotRequests, aiConnected] = await Promise.all([
    searchParams,
    listSessionStats(userId),
    listSessionsPage(userId, 1, PAGE_SIZE),
    listSpotNotes(userId),
    listBoards(userId),
    getGoal(userId),
    // the whole spot catalogue (the static Taiwan copy until the `spots`
    // migration is applied) and the viewer's own spot requests
    listSpots(),
    listOwnRequests(userId),
    // admin only: how many requests are waiting, for the menu badge
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
    // whether to show the "connect an AI app" card; on any failure assume
    // connected, so a database hiccup never nags someone who already is
    hasConnectedApp(userId).catch(() => true),
  ]);
  const latest = sessions[0] ?? null;

  // A user's own requests: the minimum needed to log against one — never
  // the requester snapshot, note or location.
  const requests = requestRows.map((r) => ({ id: r.id, name: r.name, status: r.status, spotSlug: r.spot_slug }));

  // No wrapping max-width div here any more — Journal's own flat
  // full-bleed header (2026-10-02) needs to render outside the content
  // column, so Journal applies that column itself to everything below
  // its header instead. See journal.tsx's own comment.
  return (
    <Journal initialStats={stats} initialLoaded={sessions} initialLatest={latest} initialSpotNotes={spotNotes} initialBoards={boards} initialGoal={goal} initialSpots={spots} initialRequests={requests} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} showAiAppCard={!aiConnected} user={user} openLogForm={query.log === "1"} logSpot={query.spot} />
  );
}
