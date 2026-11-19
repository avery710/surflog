import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClipReview } from "@/components/clip-review";
import { SiteHeader } from "@/components/site-header";
import { listClips, ClipsNotReady } from "@/lib/clip-db";
import { getSession } from "@/lib/db";
import { isSpotAdmin } from "@/lib/spot-admin";
import { pendingAdminWork } from "@/lib/spot-edit-requests";
import { listAllRequests } from "@/lib/spot-requests";

type Params = { params: Promise<{ id: string }> };

/** One session's video: label stretches by hand. AI suggestions land on
 *  the same screen later; this page does not call a model. */
export default async function SessionClipsPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/signin?callbackUrl=/sessions/${id}/clips`);
  }

  const { id } = await params;
  const row = await getSession(id);
  if (!row || row.ownerId !== session.user.id) notFound();

  let clips: Awaited<ReturnType<typeof listClips>> = [];
  let ready = true;
  try {
    clips = await listClips(id, session.user.id);
  } catch (e) {
    if (!(e instanceof ClipsNotReady)) throw e;
    ready = false;
  }

  const canManageSpots = isSpotAdmin(session.user);
  const pendingSpotRequests = canManageSpots
    ? await listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
    : 0;

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <ClipReview session={row} initialClips={clips} ready={ready} />
    </>
  );
}
