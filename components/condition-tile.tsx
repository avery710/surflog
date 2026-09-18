export function ConditionTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="min-w-[112px] flex-1 shrink-0 rounded-[var(--r-tile)] bg-secondary px-4 py-3.5">
      <span className="mb-1 block text-[11px] font-semibold tracking-[0.01em] text-[var(--faint)]">
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
