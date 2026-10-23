import { PageSkeleton } from "@/components/page-skeleton";

/** Shown at once on navigation while the page renders (components/page-skeleton.tsx).
 *  In the (list) group so it covers /spots only, not /spots/<slug>, which has its own. */
export default function Loading() {
  return <PageSkeleton variant="spots" />;
}
