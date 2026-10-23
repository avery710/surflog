import { notFound } from "next/navigation";
import { PageSkeleton, type PageSkeletonVariant } from "@/components/page-skeleton";

/**
 * One skeleton on its own page, meant to sit inside an <iframe> on
 * /dev/page-skeleton so the layout's sm:/lg: media queries see the iframe's
 * width. Dev only: it is under app/dev, whose layout 404s in production.
 */
const VARIANTS: PageSkeletonVariant[] = ["journal", "spots", "spot", "aiApps", "admin"];

export default async function SkeletonFrame({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as PageSkeletonVariant)) notFound();
  return <PageSkeleton variant={variant as PageSkeletonVariant} />;
}
