"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { monthCells, monthTitle, shiftMonth, WEEKDAYS } from "@/lib/calendar-grid";
import { fmtDate, todayInZone } from "@/lib/format";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * A date field that opens a month calendar (Sunday-first, in the app's
 * language), in place of the browser's own date picker, which `DateField`
 * wraps and which looks different in every browser. The one date field in
 * the app: the log form (`size` "md", same box as an Input) and the session
 * filter ("sm", 28 px to sit beside the chips). `value` is "YYYY-MM-DD" or ""
 * for none; `min` / `max` grey out days outside a range. `clearable` (default)
 * adds an × and a Clear button; leave it off for a required date. "Today"
 * defaults to Asia/Taipei, like the activity calendar; the log form passes
 * the chosen spot's own today.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "",
  min,
  max,
  label,
  size = "md",
  clearable = true,
  today: todayProp,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Shown, muted, while `value` is empty. */
  placeholder?: string;
  /** Earliest / latest day that can be picked ("YYYY-MM-DD"). */
  min?: string;
  max?: string;
  /** Accessible name for the field (the visible label is a sibling). */
  label: string;
  size?: "sm" | "md";
  clearable?: boolean;
  /** "YYYY-MM-DD" to treat as today (default: today in Asia/Taipei). */
  today?: string;
}) {
  const { lang, t } = useLang();
  const today = todayProp ?? todayInZone("Asia/Taipei");
  const small = size === "sm";
  const canClear = clearable && !!value;
  const [open, setOpen] = useState(false);
  // the month on show; set to the value's (or today's) month each time it opens
  const [view, setView] = useState(() => monthOf(value || today));

  const outOfRange = (day: string) => (!!min && day < min) || (!!max && day > max);
  const pick = (day: string) => {
    onChange(day);
    setOpen(false);
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setView(monthOf(value || today));
        setOpen(next);
      }}
    >
      <div className="relative">
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "flex w-full min-w-0 items-center border border-input bg-transparent outline-none transition-colors focus-visible:border-ring data-[state=open]:border-ring",
              small ? "h-7 gap-1.5 rounded-md pl-2 text-[13px]" : "h-8 rounded-lg pl-2.5 text-sm",
              canClear ? (small ? "pr-7" : "pr-8") : small ? "pr-2" : "pr-2.5"
            )}
          >
            {/* form size: no icon, the date needs the width (the dialog's column is narrow) */}
            {small && <CalendarDays className="size-3 shrink-0 text-muted-foreground" aria-hidden />}
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? fmtDate(value, lang, false) : placeholder}
            </span>
          </button>
        </Popover.Trigger>
        {canClear && (
          <button
            type="button"
            aria-label={t("datepicker.clear")}
            onClick={() => onChange("")}
            className={cn("absolute top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50", small ? "right-1" : "right-1.5")}
          >
            <X className="size-3" aria-hidden />
          </button>
        )}
      </div>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={8}
          className="z-50 w-[17rem] max-w-[calc(100vw-1rem)] origin-(--radix-popover-content-transform-origin) rounded-[var(--r-card)] bg-popover p-3 text-popover-foreground shadow-menu outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        >
          <div className="mb-2 flex items-center justify-between">
            <NavButton label={t("datepicker.prevMonth")} onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
              <ChevronLeft className="size-4" aria-hidden />
            </NavButton>
            <div className="text-[13px] font-bold" aria-live="polite">
              {monthTitle(view.year, view.month, lang)}
            </div>
            <NavButton label={t("datepicker.nextMonth")} onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
              <ChevronRight className="size-4" aria-hidden />
            </NavButton>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
            {WEEKDAYS[lang].map((d, i) => (
              <div key={i} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {monthCells(view.year, view.month).map((day, i) =>
              day === null ? (
                <div key={i} />
              ) : (
                <button
                  key={day}
                  type="button"
                  disabled={outOfRange(day)}
                  aria-label={fmtDate(day, lang)}
                  aria-pressed={day === value}
                  onClick={() => pick(day)}
                  className={cn(
                    "mx-auto flex size-8 items-center justify-center rounded-full font-mono text-[12.5px] outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    day === value
                      ? "bg-primary font-bold text-primary-foreground"
                      : "hover:bg-muted disabled:hover:bg-transparent",
                    day === today && day !== value && "font-bold text-primary",
                    "disabled:text-muted-foreground/40"
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              )
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12.5px] font-medium">
            <button
              type="button"
              disabled={outOfRange(today)}
              onClick={() => pick(today)}
              className="rounded-md px-2 py-1 text-primary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
            >
              {t("datepicker.today")}
            </button>
            {canClear && (
              <button
                type="button"
                onClick={() => pick("")}
                className="rounded-md px-2 py-1 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("filter.clearAll")}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function monthOf(day: string): { year: number; month: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) - 1 };
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-8 items-center justify-center rounded-full outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </button>
  );
}
