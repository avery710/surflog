import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SpotDetail, type SpotSession } from "@/components/spot-detail";
import { listSessions, listSpotNotes } from "@/lib/db";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listOwnPending, pendingAdminWork, softly, toOwn } from "@/lib/spot-edit-requests";
import { pinsSoftly } from "@/lib/spot-pins";
import { listAllRequests } from "@/lib/spot-requests";
import { resolveSpot } from "@/lib/spot-store";

type Props = { params: Promise<{ slug: string }> };

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/**
 * /spots/<slug> — one catalogue spot: what the shared catalogue says about it,
 * the viewer's own history and private note there, and everyone's reviews.
 * Any signed-in user; the history and note are the viewer's own only.
 */
export default async function SpotPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = decode(raw);
  const session = await auth();
  if (!session?.user?.id) redirect(`/signin?callbackUrl=${encodeURIComponent(`/spots/${raw}`)}`);

  const spot = await resolveSpot(slug);
  if (!spot) notFound();

  const userId = session.user.id;
  const canManageSpots = isSpotAdmin(session.user);
  const [sessions, notes, pins, ownEdits, pendingSpotRequests] = await Promise.all([
    listSessions(userId),
    listSpotNotes(userId),
    pinsSoftly(userId),
    softly(() => listOwnPending(userId, spot.slug).then((rows) => rows.map(toOwn)), []),
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
  ]);

  // Only what the history list shows, never the stored condition blobs.
  const history: SpotSession[] = sessions
    .filter((s) => s.spot === spot.slug)
    .map((s) => ({
      id: s.id,
      when: s.when,
      swellM: s.condOpenMeteo?.swellHeightM ?? s.cond?.swellHeightM ?? null,
      periodS: s.condOpenMeteo?.swellPeriodS ?? s.cond?.swellPeriodS ?? null,
      windMs: s.condOpenMeteo?.windSpeedMs ?? s.cond?.windSpeedMs ?? null,
      notes: (s.notes ?? "").trim().slice(0, 160),
    }));

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <SpotDetail
        spot={spot}
        history={history}
        note={notes[spot.slug] ?? ""}
        pinned={pins.includes(spot.slug)}
        pendingEdit={ownEdits[0] ?? null}
        canManage={canManageSpots}
      />
    </>
  );
}
