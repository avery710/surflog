import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SpotsOverview } from "@/components/spots-overview";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listOwnPending, pendingAdminWork, softly, toOwn } from "@/lib/spot-edit-requests";
import { pinsSoftly } from "@/lib/spot-pins";
import { summariesSoftly } from "@/lib/spot-reviews";
import { listAllRequests, listOwnRequests } from "@/lib/spot-requests";
import { listSpots } from "@/lib/spot-store";

/** /spots — the whole shared spot catalogue, for any signed-in user. */
export default async function SpotsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/spots");

  const userId = session.user.id;
  const canManageSpots = isSpotAdmin(session.user);
  const [spots, requestRows, pendingSpotRequests, ownEdits, reviewSummaries, pins] = await Promise.all([
    listSpots(),
    listOwnRequests(userId),
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
    // The viewer's own pending edit suggestions; none (not an error) until the table exists.
    softly(() => listOwnPending(userId).then((rows) => rows.map(toOwn)), []),
    // Star average + count per spot; none until the reviews table exists.
    summariesSoftly(),
    // The viewer's pinned spots; none until the pins table exists.
    pinsSoftly(userId),
  ]);
  // Same minimum as app/page.tsx: never the requester snapshot, note or location.
  const requests = requestRows.map((r) => ({ id: r.id, name: r.name, status: r.status, spotSlug: r.spot_slug }));

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <SpotsOverview
        initialSpots={spots}
        initialRequests={requests}
        initialEdits={ownEdits}
        initialReviews={reviewSummaries}
        initialPins={pins}
        canManage={canManageSpots}
      />
    </>
  );
}
