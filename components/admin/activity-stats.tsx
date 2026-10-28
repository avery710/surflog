"use client";

import { useLang } from "@/lib/i18n";
import type { ActivityStats } from "@/lib/account-activity";

/** /admin — people counts: sign-ups (first day seen) and daily active users.
 *  Aggregates only: nobody is named here. `stats` is null until the
 *  account_activity migration is applied. */
export function ActivityStats({ stats }: { stats: ActivityStats | null }) {
  const { t } = useLang();
  const today = stats?.daily[stats.daily.length - 1];
  const max = Math.max(1, ...(stats?.daily.map((d) => d.active) ?? []));

  const tiles = stats
    ? [
        { label: t("admin.activity.total"), value: stats.total },
        { label: t("admin.activity.newToday"), value: today?.new ?? 0 },
        { label: t("admin.activity.new7"), value: stats.new7 },
        { label: t("admin.activity.activeToday"), value: today?.active ?? 0 },
        { label: t("admin.activity.active7"), value: stats.active7 },
      ]
    : [];

  return (
    <section className="mt-7">
      <h2 className="text-base font-bold">{t("admin.activity")}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{t("admin.activityIntro")}</p>
      {!stats ? (
        <p className="mt-3 text-[13.5px] text-muted-foreground">{t("admin.activityOff")}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-[var(--r-card)] px-3.5 py-3 surface-card">
                <div className="font-mono text-[20px]">{tile.value}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{tile.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-[var(--r-card)] px-3.5 py-3 surface-card">
            <div className="text-[12px] text-muted-foreground">{t("admin.activity.chart")}</div>
            <div className="mt-2 flex h-16 items-end gap-[3px]" role="img" aria-label={t("admin.activity.chart")}>
              {stats.daily.map((d) => (
                <div
                  key={d.day}
                  className="min-w-0 flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(d.active > 0 ? 6 : 2, (d.active / max) * 100)}%` }}
                  title={`${d.day}: ${d.active} / +${d.new}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
