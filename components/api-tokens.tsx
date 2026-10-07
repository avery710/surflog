"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectAgent } from "@/components/connect-agent";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import type { ApiToken } from "@/lib/token-auth";
import { useLocalStamp } from "@/lib/use-local-stamp";

/** /ai-apps — "Connect an AI app" (components/connect-agent.tsx) on top, then
 *  everything that can already act on this journal from outside the app: apps
 *  connected by signing in (OAuth) and personal tokens, each revocable. */
export function ApiTokens({ initialTokens, mcpUrl }: { initialTokens: ApiToken[]; mcpUrl: string }) {
  const { lang, t } = useLang();
  const [tokens, setTokens] = useState(initialTokens);
  const [watching, setWatching] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const active = tokens.filter((tk) => !tk.revokedAt);
  const revoked = tokens.filter((tk) => tk.revokedAt);
  const day = useLocalStamp(lang);

  // While an agent is picked in "Connect an agent", re-read the list every few
  // seconds so a connection made in another app shows up here by itself. Only
  // while the tab is visible, and it stops after ten minutes.
  useEffect(() => {
    if (!watching) return;
    let ticks = 0;
    const id = setInterval(async () => {
      if (++ticks > 150) return clearInterval(id);
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/tokens", { cache: "no-store" }).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (Array.isArray(body?.tokens)) setTokens(body.tokens as ApiToken[]);
    }, 4000);
    return () => clearInterval(id);
  }, [watching]);

  async function revoke(id: string) {
    if (confirming !== id) {
      setConfirming(id);
      return;
    }
    setConfirming(null);
    try {
      const res = await fetch(`/api/tokens/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTokens((list) => list.map((tk) => (tk.id === id ? { ...tk, revokedAt: new Date().toISOString() } : tk)));
      toast.success(t("tokens.revoked"));
    } catch {
      toast.error(t("tokens.couldntRevoke"));
    }
  }

  return (
    <div className={`${PAGE_COLUMN} min-w-0 flex-1 pb-18 pt-6`}>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("tokens.back")}
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{t("tokens.title")}</h1>
      <p className="mt-2 max-w-prose text-[13.5px] text-muted-foreground">{t("tokens.intro")}</p>

      <ConnectAgent
        mcpUrl={mcpUrl}
        tokens={tokens}
        onSelect={setWatching}
        onCreated={(record) => setTokens((list) => [record, ...list])}
      />

      <section className="mt-7">
        <h2 className="text-base font-bold">
          {t("tokens.active")} <span className="font-mono text-muted-foreground">{active.length}</span>
        </h2>
        {active.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t("tokens.none")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {active.map((tk) => (
              <li
                key={tk.id}
                className="flex items-center gap-3 rounded-[var(--r-tile)] border bg-card px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold">
                    {tk.name}{" "}
                    <span className="font-mono text-[11.5px] font-medium text-muted-foreground">
                      {tk.kind === "app" ? tk.host : t("tokens.personal")}
                      {" · "}
                      {t(tk.scope === "read" ? "tokens.scopeRead" : "tokens.scopeWrite")}
                    </span>
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    {t("tokens.createdOn", { date: day(tk.createdAt) })} ·{" "}
                    {tk.lastUsedAt ? t("tokens.lastUsed", { date: day(tk.lastUsedAt) }) : t("tokens.neverUsed")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => revoke(tk.id)}
                  onBlur={() => setConfirming((c) => (c === tk.id ? null : c))}
                >
                  {t(confirming === tk.id ? "tokens.confirmRevoke" : "tokens.revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">
            {t("tokens.revokedList", { count: revoked.length })}
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-muted-foreground">
            {revoked.map((tk) => (
              <li key={tk.id} className="truncate">
                {tk.name} · {t("tokens.createdOn", { date: day(tk.createdAt) })}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
