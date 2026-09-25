"use client";

export function ConditionTile({
  label,
  value,
  unit,
  sub,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-[112px] shrink-0 grow basis-auto rounded-[var(--r-tile)] bg-secondary px-4 py-3.5">
      <span className="mb-1 block text-[13px] font-semibold tracking-[0.01em] text-[var(--faint)]">
        {label}
      </span>
      <span className="whitespace-nowrap font-mono text-[16px] font-medium tracking-[-0.02em] tabular-nums">
        {value ?? "—"}
        {value != null && unit ? (
          <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </span>
      {sub ? (
        <span className="mt-0.5 block whitespace-nowrap text-[11.5px] font-medium text-muted-foreground">
          {sub}
        </span>
      ) : null}
    </div>
  );
}

/** A prominent figure in the headline style shared by every tile. */
export function Figure({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <span className="text-[20px] leading-tight">
      {value ?? "—"}
      {value != null && unit ? (
        <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{unit}</span>
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
