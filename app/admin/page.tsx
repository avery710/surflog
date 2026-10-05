import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { SpotsAdmin } from "@/components/admin/spots-admin";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listAllRequests, rowToRequest } from "@/lib/spot-requests";
import { listSpots } from "@/lib/spot-store";

/** The spot admin's dashboard: spot requests to act on, and the catalogue
 *  itself. Only for accounts in SPOT_ADMIN_EMAILS (lib/spot-admin.ts) —
 *  anyone else gets a 404, same as the admin API routes. */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id || !isSpotAdmin(session.user)) notFound();

  const [spots, requestRows] = await Promise.all([listSpots(), listAllRequests()]);
  return <SpotsAdmin initialSpots={spots} initialRequests={requestRows.map((r) => rowToRequest(r, true))} />;
}
