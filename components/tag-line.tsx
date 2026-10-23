import { Tag } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { tagLabel } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * A session's tags as one quiet line under its notes (design chosen
 * 2026-10-23 at /dev/tags): a tag icon in a soft circle, then the words
 * separated by dots, in the viewer's language (starters translate, the user's
 * own tags stay as typed). Not tappable. Renders nothing without tags.
 * Pure markup, so the card and any read-only view can use it.
 */
export function TagLine({
  tags,
  lang,
  label,
  className,
}: {
  tags: readonly string[] | undefined;
  lang: Lang;
  /** Screen-reader name for the icon ("Tags"). */
  label: string;
  className?: string;
}) {
  if (!tags?.length) return null;
  return (
    <p className={cn("flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] font-medium text-muted-foreground", className)}>
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Tag className="size-3 opacity-70" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
      {tags.map((tag, i) => (
        <span key={tag} className="min-w-0 break-words">
          {tagLabel(tag, lang)}
          {i < tags.length - 1 && (
            <span aria-hidden className="ml-1.5 opacity-40">
              ·
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
