"use client";

import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { AnimatedHeight } from "@/components/animated-height";
import { useLang, type TKey } from "@/lib/i18n";
import {
  MAX_TAGS,
  MAX_TAG_LENGTH,
  STARTER_TAG_GROUPS,
  canonicalTag,
  quickTags,
  starterOf,
  tagLabel,
} from "@/lib/tags";
import { cn } from "@/lib/utils";

/**
 * The tag picker in the log form and the edit panel (SURFLOG-11; design chosen
 * 2026-10-23 at /dev/tags: grouped chips). Controlled: `value` is the stored
 * list (lib/tags.ts), at most MAX_TAGS.
 *
 * Collapsed (the start, 2026-10-23 on request): one row with the tags already
 * picked, then the user's most used ones (topped up with a few common starters
 * for someone with no history), then "+ Add tag". "All tags" opens the full
 * grouped list: small labelled rows (Waves, Size, Crowd, Others), then "Yours"
 * (the user's own tags from earlier sessions) with "+ Add tag". Tap a chip to
 * toggle it; "+ Add tag" turns into a small input (Enter adds).
 *
 * The history comes from the journal's slim session list through
 * KnownTagsProvider, so the picker needs no request of its own.
 */

const EMPTY: TagHistory = { custom: [], counts: new Map() };
interface TagHistory {
  /** The user's own (non-starter) tags, most used first. */
  custom: readonly string[];
  /** Sessions carrying each stored tag. */
  counts: ReadonlyMap<string, number>;
}
const TagHistoryContext = createContext<TagHistory>(EMPTY);

/** Gives every TagPicker below it the user's tag history. */
export function KnownTagsProvider({
  custom,
  counts,
  children,
}: {
  custom: readonly string[];
  counts: ReadonlyMap<string, number>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ custom, counts }), [custom, counts]);
  return <TagHistoryContext.Provider value={value}>{children}</TagHistoryContext.Provider>;
}

const chipOff =
  "bg-secondary text-muted-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_4%)] hover:text-foreground";

function PickChip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[13px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        // picked = filled blue, no check mark (the chip doesn't change width when toggled)
        on ? "bg-primary text-primary-foreground" : chipOff
      )}
    >
      {children}
    </button>
  );
}

/** "+ Add tag", which becomes an input. Enter or leaving the field adds; Escape cancels. */
function AddTag({ onAdd, disabled }: { onAdd: (text: string) => void; disabled: boolean }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const close = () => {
    setText("");
    setOpen(false);
  };
  const submit = () => {
    if (text.trim()) onAdd(text);
    close();
  };
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2.5 text-[13px] font-medium text-muted-foreground outline-none hover:border-foreground/50 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden />
        {t("form.tagsAdd")}
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={text}
      maxLength={MAX_TAG_LENGTH}
      onChange={(e) => setText(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        // Enter picks a 注音/倉頡 candidate while composing; it must not add the tag
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          submit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation(); // don't close the dialog this sits in
          close();
        }
      }}
      placeholder={t("form.tagsType")}
      aria-label={t("form.tagsAdd")}
      className="tag-input h-7 w-32 rounded-full border border-primary bg-background px-3 text-[13px] outline-none"
    />
  );
}

export function TagPicker({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { lang, t } = useLang();
  const { custom, counts } = useContext(TagHistoryContext);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const full = value.length >= MAX_TAGS;
  const has = (tag: string) => value.some((v) => v.toLowerCase() === tag.toLowerCase());

  const toggle = (tag: string) => onChange(has(tag) ? value.filter((v) => v.toLowerCase() !== tag.toLowerCase()) : [...value, tag]);
  const add = (text: string) => {
    const tag = canonicalTag(text, custom);
    if (tag && !has(tag) && !full) onChange([...value, tag]);
  };

  // the user's own tags: those from earlier sessions, then any picked here that are new
  const mine = useMemo(() => {
    const list = [...custom];
    for (const v of value) if (!starterOf(v) && !list.some((k) => k.toLowerCase() === v.toLowerCase())) list.push(v);
    return list;
  }, [custom, value]);
  const quick = useMemo(() => quickTags(value, counts), [value, counts]);

  const chip = (tag: string) => (
    <PickChip key={tag} on={has(tag)} disabled={disabled || (full && !has(tag))} onClick={() => toggle(tag)}>
      {tagLabel(tag, lang)}
    </PickChip>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("form.tags")}</span>
        <span className="flex items-baseline gap-3">
          {full && <span className="text-[11px] font-medium text-muted-foreground">{t("form.tagsFull", { n: MAX_TAGS })}</span>}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-0.5 rounded-full px-1 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {expanded ? t("form.tagsFewer") : t("form.tagsAll")}
            <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
          </button>
        </span>
      </div>
      <AnimatedHeight>
        <div id={listId} className="flex flex-col gap-2">
          {expanded ? (
            <>
              {STARTER_TAG_GROUPS.map((group) => (
                <div key={group.id} className="flex flex-col gap-1">
                  <span className="pl-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                    {t(`tags.group.${group.id}` as TKey)}
                  </span>
                  <div className="flex flex-wrap gap-1.5">{group.tags.map((tag) => chip(tag.key))}</div>
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <span className="pl-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground/80 uppercase">
                  {t("form.tagsMine")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mine.map((tag) => chip(tag))}
                  <AddTag onAdd={add} disabled={!!disabled || full} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {quick.map((tag) => chip(tag))}
              <AddTag onAdd={add} disabled={!!disabled || full} />
            </div>
          )}
        </div>
      </AnimatedHeight>
    </div>
  );
}
