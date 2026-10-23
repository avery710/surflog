import { auth } from "@/auth";
import { PageSkeleton } from "@/components/page-skeleton";

/** Shown at once on navigation while the page renders (components/page-skeleton.tsx).
 *  In the (list) group so it covers /spots only, not /spots/<slug>, which has its own. */
export default async function Loading() {
  // The cookie only (no database), so the profile button is the real one at once.
  const session = await auth();
  return <PageSkeleton variant="spots" user={session?.user ?? undefined} />;
}
