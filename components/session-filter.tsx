"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, MapPin, WandSparkles, X } from "lucide-react";
import { DatePicker } from "@/components/date-picker";
import { Tooltip } from "@/components/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { boardLabel, sortBoards } from "@/lib/boards";
import { fmtDate, fmtMonthDay, todayInZone } from "@/lib/format";
import { useLang, type DICT } from "@/lib/i18n";
import {
  activeFilterCount,
  datePresetOf,
  datePresets,
  NO_BOARD,
  type DatePresetId,
  type SessionFilter,
} from "@/lib/session-filter";
import type { SessionStat } from "@/lib/session-stats";
import { useSpotCatalog } from "@/lib/spot-catalog";
import type { Board } from "@/lib/types";
import { cn } from "@/lib/utils";

// Radix radio groups can't use "" as a value, so "any" gets a sentinel.
const ANY = "__any__";
const PRESET_KEY: Record<DatePresetId, keyof typeof DICT> = {
  all: "filter.anyTime",
  last3: "filter.last3",
  lastWeek: "filter.lastWeek",
  last30: "filter.last30",
  last90: "filter.last90",
  year: "filter.thisYear",
};

/**
 * The header of the sessions section: "Sessions", then a row of filter chips
 * (Date · Spot · Board). Each chip opens a small menu; unset it is just an
 * icon, set it grows into a blue pill with its value and a Clear button
 * appears. The Date menu has
 * quick ranges plus "Custom range", which shows exact From / To fields under
 * the chips. The filter itself lives in the session feed
 * (lib/use-session-feed.ts), which re-queries the paged API; this only edits
 * it. Spots offered are the ones the owner has sessions at; boards are the
 * rack, plus "No board" when some sessions have none.
 */
export function SessionFilterBar({
  filter,
  onChange,
  stats,
  boards,
  matching,
}: {
  filter: SessionFilter;
  onChange: (next: SessionFilter) => void;
  /** Every session, slim: the source of the spot options. */
  stats: Pick<SessionStat, "spot" | "boardId">[];
  boards: Board[];
  /** How many sessions pass the filter. */
  matching: number;
}) {
  const { lang, t } = useLang();
  const catalog = useSpotCatalog();
  const [customOpen, setCustomOpen] = useState(false);
  const active = activeFilterCount(filter);

  // Sessions are dated in the spot's local time; every spot is UTC+8 today
  // (CLAUDE.md "Spots"), the same assumption as the activity calendar.
  const today = todayInZone("Asia/Taipei");
  const preset = datePresetOf(filter, today);
  const showCustom = customOpen || preset === "custom";

  const spotOptions = useMemo(() => {
    const slugs = [...new Set(stats.map((s) => s.spot).filter(Boolean))];
    return slugs
      .map((slug) => ({ slug, label: catalog.label(slug, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label, lang));
  }, [stats, catalog, lang]);
  const sortedBoards = useMemo(() => sortBoards(boards), [boards]);
  const hasBoardless = stats.some((s) => !s.boardId);

  const set = (patch: Partial<SessionFilter>) => {
    const next: SessionFilter = { ...filter, ...patch };
    // keep the range the right way round: moving one end past the other drags it along
    if (next.from && next.to && next.from > next.to) {
      if ("from" in patch) next.to = next.from;
      else next.from = next.to;
    }
    for (const k of Object.keys(next) as (keyof SessionFilter)[]) if (!next[k]) delete next[k];
    onChange(next);
  };

  const dateLabel =
    preset === "custom"
      ? filter.from && filter.to
          ? `${fmtDate(filter.from, lang, false)} - ${
              // same year: the end date's year is already on the start date
              filter.from.slice(0, 4) === filter.to.slice(0, 4) ? fmtMonthDay(filter.to, lang) : fmtDate(filter.to, lang, false)
            }`
          : filter.from
            ? t("filter.since", { d: fmtDate(filter.from, lang, false) })
            : t("filter.until", { d: fmtDate(filter.to ?? "", lang, false) })
      : preset === "all"
        ? undefined
        : t(PRESET_KEY[preset]);
  const spotName = filter.spot ? catalog.label(filter.spot, lang) : undefined;
  const board = filter.board && filter.board !== NO_BOARD ? boards.find((b) => b.id === filter.board) : undefined;
  const boardName = filter.board === NO_BOARD ? t("form.noBoard") : board ? boardLabel(board) || t("filter.unnamedBoard") : undefined;

  return (
    <div>
      {/* Below `lg` the title sits above the chips; from `lg` they share one line, chips on the right. */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="inline-flex items-center gap-1.5 pl-1 font-sans text-[13px] font-bold text-muted-foreground">
          {t("section.sessions")}
          {active > 0 && (
            <>
              {/* how many match: a small grey badge in the title row, so it takes no line of its own */}
              <span
                aria-hidden
                className="inline-flex h-4 min-w-4 animate-in items-center justify-center rounded-full bg-secondary px-1.5 font-mono text-[10.5px] font-semibold text-foreground duration-200 fade-in-0 zoom-in-90 motion-reduce:animate-none"
              >
                {matching}
              </span>
              <span className="sr-only" aria-live="polite">
                {t(matching === 1 ? "calendar.session" : "calendar.sessions", { n: matching })}
              </span>
            </>
          )}
        </div>

        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 py-0.5 lg:mt-0 lg:justify-end">
          <Chip
            icon={<CalendarDays className="size-3.5" aria-hidden />}
            label={t("filter.byDate")}
            value={dateLabel}
            wide={preset === "custom"}
          >
            <DropdownMenuRadioGroup
              value={showCustom ? "custom" : preset}
              onValueChange={(id) => {
                if (id === "custom") return setCustomOpen(true);
                setCustomOpen(false);
                const range = datePresets(today).find((p) => p.id === id)!.range;
                set({ from: range.from, to: range.to });
              }}
            >
              {datePresets(today).map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  {t(PRESET_KEY[p.id])}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value="custom">{t("filter.custom")}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </Chip>

          <Chip icon={<MapPin className="size-3.5" aria-hidden />} label={t("filter.bySpot")} value={spotName}>
            <DropdownMenuRadioGroup
              value={filter.spot ?? ANY}
              onValueChange={(v) => set({ spot: v === ANY ? undefined : v })}
            >
              <DropdownMenuRadioItem value={ANY}>{t("filter.allSpots")}</DropdownMenuRadioItem>
              {spotOptions.map((o) => (
                <DropdownMenuRadioItem key={o.slug} value={o.slug}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </Chip>

          {(sortedBoards.length > 0 || filter.board) && (
            <Chip icon={<WandSparkles className="size-3.5" aria-hidden />} label={t("filter.byBoard")} value={boardName}>
              <DropdownMenuRadioGroup
                value={filter.board ?? ANY}
                onValueChange={(v) => set({ board: v === ANY ? undefined : v })}
              >
                <DropdownMenuRadioItem value={ANY}>{t("filter.allBoards")}</DropdownMenuRadioItem>
                {(hasBoardless || filter.board === NO_BOARD) && (
                  <DropdownMenuRadioItem value={NO_BOARD}>{t("form.noBoard")}</DropdownMenuRadioItem>
                )}
                {sortedBoards.map((b) => (
                  <DropdownMenuRadioItem key={b.id} value={b.id}>
                    {boardLabel(b) || t("filter.unnamedBoard")}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </Chip>
          )}

          {active > 0 && (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange({});
              }}
              className="inline-flex h-7 shrink-0 animate-in items-center gap-1 rounded-full px-2 text-[13px] font-medium text-muted-foreground duration-200 fade-in-0 slide-in-from-left-2 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:animate-none"
            >
              <X className="size-3.5" aria-hidden />
              {t("filter.clearAll")}
            </button>
          )}
        </div>
      </div>

      {showCustom && (
        <div className="mt-2 grid animate-in grid-cols-2 gap-2 duration-200 fade-in-0 slide-in-from-top-1 sm:max-w-sm lg:ml-auto motion-reduce:animate-none">
          <RangeField label={t("filter.from")} value={filter.from ?? ""} onChange={(v) => set({ from: v })} max={filter.to} />
          <RangeField label={t("filter.to")} value={filter.to ?? ""} onChange={(v) => set({ to: v })} min={filter.from} />
        </div>
      )}

    </div>
  );
}

/**
 * One filter chip. Unset: a small round icon button. Set: a blue pill with the
 * value and a chevron. It is ONE element either way, so selecting and
 * deselecting animate: the fill crossfades and the value + chevron slide open
 * or shut (a 0fr ↔ 1fr grid column, which can animate to the text's own
 * width). Always opens `children` as a menu; its tooltip is the filter's name.
 */
function Chip({
  icon,
  label,
  value,
  wide = false,
  children,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  // keep the last value on screen while the chip closes up, or the text would vanish at once
  const [shown, setShown] = useState(value);
  if (value && value !== shown) setShown(value);
  const set = !!value;
  // No tooltip while the menu is open or just after it closes: closing returns
  // focus to the chip, and that (keyboard-style) focus would show the tip.
  const [quiet, setQuiet] = useState(false);
  const quietTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(quietTimer.current), []);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        clearTimeout(quietTimer.current);
        setQuiet(true);
        if (!open) quietTimer.current = setTimeout(() => setQuiet(false), 400);
      }}
    >
      <Tooltip tip={label} suppress={quiet}>
        <DropdownMenuTrigger
          aria-label={value ? `${label}: ${value}` : label}
          className={cn(
            "inline-flex h-7 shrink-0 items-center rounded-full text-[13px] font-medium outline-none transition-[background-color,color,padding] duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
            set
              ? "bg-primary pr-2 pl-2.5 text-primary-foreground"
              : "bg-secondary px-2 text-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]"
          )}
        >
          <span className="inline-flex items-center">
            {icon}
            <span
              aria-hidden
              className={cn(
                "grid transition-[grid-template-columns,opacity,margin] duration-200 ease-out motion-reduce:transition-none",
                set ? "ml-1 grid-cols-[1fr] opacity-100" : "ml-0 grid-cols-[0fr] opacity-0"
              )}
            >
              <span className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
                <span className={cn("truncate", wide ? "max-w-[18rem]" : "max-w-[8rem]")}>{shown}</span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </span>
            </span>
          </span>
        </DropdownMenuTrigger>
      </Tooltip>
      {/* `!` beats the shared menu's min-w-[220px]: these lists are short words */}
      <DropdownMenuContent align="start" className="max-h-72 min-w-[150px]! overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One end of the custom range: a label over a date picker. */
function RangeField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const { t } = useLang();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="pl-0.5 text-[13px] font-semibold text-muted-foreground">{label}</span>
      <DatePicker size="sm" value={value} onChange={onChange} placeholder={t("filter.anyDate")} label={label} min={min} max={max} />
    </div>
  );
}
