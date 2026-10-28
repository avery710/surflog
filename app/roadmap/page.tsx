import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Roadmap } from "@/components/roadmap";
import { SiteHeader } from "@/components/site-header";
import { getGoal, listSessionStats } from "@/lib/db";
import { roadmapSoftly } from "@/lib/roadmap-store";
import { isSpotAdmin } from "@/lib/spot-admin";
import { listAllRequests } from "@/lib/spot-requests";
import { pendingAdminWork } from "@/lib/spot-edit-requests";

/**
 * /roadmap (SURFLOG-38): the signed-in user's own roadmap. `?level=2` opens
 * a level, `?skill=<id or starter key>` opens and scrolls to a skill. Until
 * the roadmap migration is applied the page says it isn't switched on yet.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; skill?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/roadmap");

  const userId = session.user.id;
  const canManageSpots = isSpotAdmin(session.user);
  const [query, roadmap, goal, stats, pendingSpotRequests] = await Promise.all([
    searchParams,
    roadmapSoftly(userId),
    getGoal(userId),
    // every session's goal ticks, slim: a step's progress is how many ticked its wording
    listSessionStats(userId),
    canManageSpots
      ? listAllRequests().then((rows) => pendingAdminWork(rows.filter((r) => r.status === "pending").length))
      : 0,
  ]);
  const sessions = stats.map((s) => ({ goalText: s.goalText, goalMet: s.goalMet, goalPointsMet: s.goalPointsMet }));
  const level = query.level != null ? Number(query.level) : undefined;

  return (
    <>
      <SiteHeader user={session.user} canManageSpots={canManageSpots} pendingSpotRequests={pendingSpotRequests} />
      <Roadmap
        initial={roadmap ? { ...roadmap, goal } : null}
        sessions={sessions}
        initialLevel={Number.isInteger(level) ? level : undefined}
        focus={query.skill}
      />
    </>
  );
}
