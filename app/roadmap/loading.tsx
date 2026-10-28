import { auth } from "@/auth";
import { PageSkeleton } from "@/components/page-skeleton";

/** Shown at once on navigation while /roadmap renders (components/page-skeleton.tsx). */
export default async function Loading() {
  // The cookie only (no database), so the profile button is the real one at once.
  const session = await auth();
  return <PageSkeleton variant="roadmap" user={session?.user ?? undefined} />;
}
