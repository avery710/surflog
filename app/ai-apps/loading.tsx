import { PageSkeleton } from "@/components/page-skeleton";

/** Shown at once on navigation while the page renders (components/page-skeleton.tsx). */
export default function Loading() {
  return <PageSkeleton variant="aiApps" />;
}
