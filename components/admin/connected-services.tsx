"use client";

import { useLang } from "@/lib/i18n";
import type { ConnectedService } from "@/lib/oauth";
import { useLocalStamp } from "@/lib/use-local-stamp";

/** /admin — which apps (Claude, ChatGPT…) people have connected through OAuth
 *  sign-in, with counts. Aggregates only: no user is named here. */
export function ConnectedServices({ services }: { services: ConnectedService[] }) {
  const { lang, t } = useLang();
  const stamp = useLocalStamp(lang);

  return (
    <section className="mt-9">
      <h2 className="text-base font-bold">{t("admin.services")}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">{t("admin.servicesIntro")}</p>
      {services.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-muted-foreground">{t("admin.servicesNone")}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-[var(--r-tile)] border bg-card">
          <table className="w-full min-w-[420px] text-left text-[13.5px]">
            <thead className="text-[12px] text-muted-foreground">
              <tr>
                <th className="px-3.5 py-2 font-semibold">{t("admin.service")}</th>
                <th className="px-3.5 py-2 text-right font-semibold">{t("admin.serviceUsers")}</th>
                <th className="px-3.5 py-2 text-right font-semibold">{t("admin.serviceConnections")}</th>
                <th className="px-3.5 py-2 font-semibold">{t("admin.serviceLastUsed")}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={`${s.kind}:${s.name}:${s.host}`} className="border-t">
                  <td className="px-3.5 py-2.5">
                    <span className="font-semibold">{s.kind === "app" ? s.name : t("admin.servicePersonal")}</span>
                    {s.host && <span className="ml-2 font-mono text-[12px] text-muted-foreground">{s.host}</span>}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono">{s.users}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono">{s.connections}</td>
                  <td className="px-3.5 py-2.5 text-muted-foreground">
                    {s.lastUsedAt ? stamp(s.lastUsedAt) : t("admin.serviceNeverUsed")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
