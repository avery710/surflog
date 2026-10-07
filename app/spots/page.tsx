import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SpotsOverview } from "@/components/spots-overview";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listAllRequests, listOwnRequests } from "@/lib/spot-requests";
import { listSpots } from "@/lib/spot-store";

/** /spots — the whole shared spot catalogue, for any signed-in user. */
export default async function SpotsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/spots");

  const canManageSpots = isSpotAdmin(session.user);
  const [spots, requestRows, pendingSpotRequests] = await Promise.all([
    listSpots(),
    listOwnRequests(session.user.id),
    canManageSpots ? listAllRequests().then((rows) => rows.filter((r) => r.status === "pending").length) : 0,
  ]);
  // Same minimum as app/page.tsx: never the requester snapshot, note or location.
  const requests = requestRows.map((r) => ({ id: r.id, name: r.name, status: r.status, spotSlug: r.spot_slug }));

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <SpotsOverview initialSpots={spots} initialRequests={requests} canManage={canManageSpots} />
    </>
  );
}
