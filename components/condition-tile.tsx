"use client";

export function ConditionTile({
  label,
  value,
  unit,
  sub,
  className = "",
  subClassName = "",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  className?: string;
  subClassName?: string;
}) {
  return (
    // Shrunk 2026-10-01 (smaller padding, min-width, figure/label sizes) so
    // the condition tiles read as secondary, supporting info under the now-
    // prominent notes — see entry-card.tsx's comment above where this is
    // used. lg:min-w- is deliberately small; callers that need a specific
    // lg width (e.g. the tide tile, which must leave room for its chart)
    // set it themselves via `className`.
    <div
      className={`min-w-0 shrink-0 grow basis-auto rounded-[var(--r-tile)] bg-secondary px-2.5 py-2 sm:px-3 sm:py-2.5 lg:min-w-[60px] ${className}`}
    >
      <span className="mb-0.5 block text-[11px] font-semibold tracking-[0.01em] text-[var(--faint)]">
        {label}
      </span>
      {/* Row 1 is a flex line with an explicit 20px height (= Figure's
          leading-tight at 16px), not an inline line box whose height depends
          on inherited leading and CJK fallback fonts — so the wind tile's
          two-row value and the swell tile's single figure share one grid. */}
      <span className="flex min-h-5 items-baseline whitespace-nowrap font-mono text-[14px] font-medium leading-5 tracking-[-0.02em] tabular-nums">
        {value ?? "—"}
        {value != null && unit ? (
          <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </span>
      {sub ? (
        <span className={`mt-0.5 block whitespace-nowrap text-[10.5px] font-medium text-muted-foreground ${subClassName}`}>
          {sub}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A prominent figure in the headline style shared by every tile. Shrunk
 * 20px -> 16px (2026-10-01, smaller cards) — still `font-mono`, kept
 * uniform across every tile (see CLAUDE.md: tried Funnel Sans bold once,
 * reverted the same day).
 */
export function Figure({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <span className="text-[16px] leading-tight">
      {value ?? "—"}
      {value != null && unit ? (
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
      ) : null}
    </span>
  );
}

export function FigureRow({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-start gap-4">{children}</span>;
}

/** A big figure's unit, in the muted small style. */
export function Unit({ children }: { children: React.ReactNode }) {
  return <span className="ml-0.5 font-sans text-[12px] font-normal text-muted-foreground">{children}</span>;
}

/**
 * One reading laid out like a tide-app overlay: a small teal label with the
 * big figure right beside it ("浪高 0.9 m"), and optional fine print below.
 */
export function StatCard({
  label,
  children,
  sub,
  className = "min-w-[150px] flex-1",
}: {
  label: React.ReactNode;
  children?: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--r-tile)] bg-secondary px-4 py-3.5 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-[12.5px] font-semibold tracking-[0.01em] text-primary">{label}</span>
        {children != null && (
          <span className="inline-flex items-baseline gap-3 font-mono text-[24px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
            {children}
          </span>
        )}
      </div>
      {sub ? <div className="mt-2 text-[11.5px] font-medium text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
