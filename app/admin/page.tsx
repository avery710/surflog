import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ConnectedServices } from "@/components/admin/connected-services";
import { SpotsAdmin } from "@/components/admin/spots-admin";
import { SiteHeader } from "@/components/site-header";
import { listConnectedServices } from "@/lib/oauth";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listAllRequests, rowToRequest } from "@/lib/spot-requests";
import { listSpots } from "@/lib/spot-store";

/** The spot admin's dashboard: spot requests to act on, and the catalogue
 *  itself, plus which apps people have connected (counts only). Only for accounts in SPOT_ADMIN_EMAILS (lib/spot-admin.ts) —
 *  anyone else gets a 404, same as the admin API routes. */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id || !isSpotAdmin(session.user)) notFound();

  const [spots, requestRows, services] = await Promise.all([listSpots(), listAllRequests(), listConnectedServices()]);
  return (
    <>
      <SiteHeader
        user={session.user}
        canManageSpots
        pendingSpotRequests={requestRows.filter((r) => r.status === "pending").length}
      />
      <SpotsAdmin initialSpots={spots} initialRequests={requestRows.map((r) => rowToRequest(r, true))}>
        <ConnectedServices services={services} />
      </SpotsAdmin>
    </>
  );
}
