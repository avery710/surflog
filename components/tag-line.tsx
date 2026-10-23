import { Hash } from "lucide-react";
import type { Lang } from "@/lib/i18n";
import { tagLabel } from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * A session's tags as one quiet line under its notes: a bare # in the
 * tags' own grey (no circle, no background, no opacity), then the words
 * separated by dots, in the viewer's language (starters translate, the user's
 * own tags stay as typed). Not tappable. Renders nothing without tags.
 * (The # replaced the Tags icon on request; the # in a soft circle came before that.)
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
      <Hash className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{label}</span>
      {tags.map((tag, i) => (
        <span key={tag} className="min-w-0 break-words">
          {tagLabel(tag, lang)}
          {i < tags.length - 1 && (
            <span aria-hidden className="ml-1.5">
              ·
            </span>
          )}
        </span>
      ))}
    </p>
  );
}
