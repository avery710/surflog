"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { AnimatedHeight } from "@/components/animated-height";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
 * Collapsed (the start): the tags already picked, then the user's most used
 * ones (topped up with a few common starters for someone with no history), then
 * "+ Add tag". "All tags" opens the full grouped list: small labelled rows
 * (Waves, Size, Crowd, Others), then "Yours" (the user's own tags) with
 * "+ Add tag". Tap a chip to toggle it.
 *
 * Removing (2026-10-24, on request): a × on a custom tag under "Yours" strips
 * it from every one of the user's sessions, after a confirmation that gives the
 * count and says it can't be undone. The sessions themselves stay. Only the
 * picker's own lists update at once; the session cards and the filter catch up
 * on the next page load.
 *
 * The history comes from the journal (KnownTagsProvider), so the picker needs
 * no request of its own to open. Removal goes through DELETE /api/tags.
 */

interface TagHistory {
  /** The user's own (non-starter) tags, most used first. */
  custom: readonly string[];
  /** Sessions carrying each stored tag. */
  counts: ReadonlyMap<string, number>;
  /** Custom tags removed in this page load, as stored: hidden from the lists. */
  gone: readonly string[];
  /** Strips a custom tag from every session. Resolves true when it worked. */
  remove: (tag: string) => Promise<boolean>;
}

const NO_HISTORY: TagHistory = { custom: [], counts: new Map(), gone: [], remove: async () => false };
const TagHistoryContext = createContext<TagHistory>(NO_HISTORY);

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

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
  const [gone, setGone] = useState<string[]>([]);
  const { t } = useLang();

  const remove = useCallback(
    async (tag: string): Promise<boolean> => {
      const res = await fetch(`/api/tags?tag=${encodeURIComponent(tag)}`, { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as { error?: string; updated?: number } | null;
      if (!res.ok) {
        toast.error(body?.error ?? t("form.tagsRemoveFailed"));
        return false;
      }
      setGone((g) => (g.some((x) => same(x, tag)) ? g : [...g, tag]));
      toast.success(t("form.tagsRemoved", { tag, n: body?.updated ?? 0 }));
      return true;
    },
    [t]
  );

  const value = useMemo<TagHistory>(() => ({ custom, counts, gone, remove }), [custom, counts, gone, remove]);
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

/**
 * One of the user's own tags: toggles it, and a × (only when it isn't picked)
 * asks to remove it from every session.
 */
function YoursChip({
  tag,
  count,
  on,
  disabled,
  onToggle,
  onRemove,
}: {
  tag: string;
  count: number;
  on: boolean;
  disabled: boolean;
  onToggle: () => void;
  onRemove: (tag: string) => Promise<boolean>;
}) {
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const ok = await onRemove(tag);
    setBusy(false);
    if (ok) setConfirming(false);
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full text-[13px] font-medium transition-colors",
        on ? "bg-primary text-primary-foreground" : chipOff
      )}
    >
      <button
        type="button"
        aria-pressed={on}
        disabled={disabled}
        onClick={onToggle}
        // equal padding when there is no × (picked); the × takes the right side otherwise
        className={cn(
          "inline-flex h-full items-center rounded-full pl-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          on ? "pr-3" : "pr-1"
        )}
      >
        {tag}
      </button>
      {!on && (
        <button
          type="button"
          aria-label={t("form.tagsRemove", { tag })}
          title={t("form.tagsRemove", { tag })}
          onClick={() => setConfirming(true)}
          className="mr-1 flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open);
        }}
      >
        <DialogContent closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t("form.tagsRemoveTitle", { tag })}</DialogTitle>
            <DialogDescription>{t("form.tagsRemoveBody", { n: count })}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="rounded-full" onClick={() => setConfirming(false)} disabled={busy}>
              {t("edit.cancel")}
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={() => void run()} disabled={busy}>
              {t("form.tagsRemoveConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

/**
 * "+ Add tag", which becomes an input. It starts the width of the dashed
 * button (85 px) and grows with what is typed: the input and a hidden copy of
 * its text share one grid cell, so the cell is as wide as the longer of the
 * two (Chinese too). Enter or leaving the field adds; Escape cancels.
 */
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
    <span className="inline-grid h-7 min-w-[85px] max-w-full rounded-full border border-primary bg-background">
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
        // `.tag-input` keeps iOS from zooming on focus (see app/globals.css);
        // w-0 + min-w-full lets the cell, not the input's own default width, set the size
        className="tag-input col-start-1 row-start-1 w-0 min-w-full rounded-full bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground/70"
      />
      <span aria-hidden className="col-start-1 row-start-1 invisible px-3 text-[13px] whitespace-pre">
        {text || "  "}
      </span>
    </span>
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
  const { custom, counts, gone, remove } = useContext(TagHistoryContext);
  const [expanded, setExpanded] = useState(false);
  const full = value.length >= MAX_TAGS;
  const has = (tag: string) => value.some((v) => same(v, tag));

  const toggle = (tag: string) => onChange(has(tag) ? value.filter((v) => !same(v, tag)) : [...value, tag]);
  const add = (text: string) => {
    const tag = canonicalTag(text, custom);
    if (tag && !has(tag) && !full) onChange([...value, tag]);
  };

  // The user's own tags the picker offers: those from earlier sessions that
  // haven't been removed here, then any picked in this draft that are new.
  const mine = useMemo(() => {
    const list = custom.filter((tag) => !gone.some((g) => same(g, tag)));
    for (const v of value) if (!starterOf(v) && !list.some((k) => same(k, v))) list.push(v);
    return list;
  }, [custom, value, gone]);

  // What the collapsed row can offer: removed tags never come back into it.
  const visibleCounts = useMemo(() => {
    const out = new Map<string, number>();
    for (const [tag, n] of counts) if (!gone.some((g) => same(g, tag))) out.set(tag, n);
    return out;
  }, [counts, gone]);
  const quick = useMemo(() => quickTags(value, visibleCounts), [value, visibleCounts]);

  // sessions carrying a tag, counting its spellings together
  const countOf = (tag: string) => {
    let n = 0;
    for (const [k, c] of counts) if (same(k, tag)) n += c;
    return n;
  };

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
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-0.5 rounded-full px-1 text-xs font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {expanded ? t("form.tagsFewer") : t("form.tagsAll")}
            <ChevronDown className={cn("size-3.5 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden />
          </button>
        </span>
      </div>
      <AnimatedHeight>
        <div className="flex flex-col gap-2">
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
                  {mine.map((tag) => (
                    <YoursChip
                      key={tag}
                      tag={tag}
                      count={countOf(tag)}
                      on={has(tag)}
                      disabled={!!disabled || (full && !has(tag))}
                      onToggle={() => toggle(tag)}
                      onRemove={remove}
                    />
                  ))}
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
