"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogForm } from "@/components/log-form";
import { KnownTagsProvider } from "@/components/tag-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SpotCatalogProvider, type OwnRequest } from "@/lib/spot-catalog";
import { useLang } from "@/lib/i18n";
import { customTagsOf, tagCounts } from "@/lib/tags";
import type { SessionStat } from "@/lib/session-stats";
import type { Spot } from "@/lib/spots";
import type { Board } from "@/lib/types";

/** Ask the dialog below to open (e.g. a spot page's "Log a session here"). */
export const OPEN_LOG_EVENT = "surflog:open-log";
export const openLogDialog = (spot?: string) =>
  window.dispatchEvent(new CustomEvent(OPEN_LOG_EVENT, { detail: { spot } }));

interface LogContext {
  stats: SessionStat[];
  boards: Board[];
  goal: string | null;
  spots: Spot[];
  requests: OwnRequest[];
}

/**
 * The log-session dialog for every page except the journal (which has its own
 * in components/journal.tsx): opens over whatever page you are on, so the "+"
 * never navigates. The form's data (boards, goal, spots, history) is fetched
 * from /api/log-context when it opens. Only once the session is saved does it
 * go to the journal, where the new card is.
 */
export function GlobalLogDialog({ ownerId }: { ownerId?: string }) {
  const { t } = useLang();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<LogContext | null>(null);
  const [failed, setFailed] = useState(false);

  const show = useCallback((preset?: string) => {
    setSpot(preset);
    setOpen(true);
  }, []);
  useEffect(() => {
    const onEvent = (e: Event) => show((e as CustomEvent<{ spot?: string }>).detail?.spot);
    window.addEventListener(OPEN_LOG_EVENT, onEvent);
    return () => window.removeEventListener(OPEN_LOG_EVENT, onEvent);
  }, [show]);

  // fresh data on each open: the history changes whenever a session is saved
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/log-context", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: LogContext) => {
        if (cancelled) return;
        setFailed(false);
        setCtx(data);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // spots / requests added while the form is open ride on top of the fetched ones
  const [extraSpots, setExtraSpots] = useState<Spot[]>([]);
  const [extraRequests, setExtraRequests] = useState<OwnRequest[]>([]);
  const spots = useMemo(
    () => [...(ctx?.spots ?? []), ...extraSpots.filter((x) => !ctx?.spots.some((s) => s.slug === x.slug))],
    [ctx, extraSpots]
  );
  const requests = useMemo(
    () => [...extraRequests, ...(ctx?.requests ?? []).filter((r) => !extraRequests.some((x) => x.id === r.id))],
    [ctx, extraRequests]
  );
  const tagHistory = useMemo(
    () => ({ custom: customTagsOf(ctx?.stats ?? []).map((c) => c.tag), counts: tagCounts(ctx?.stats ?? []) }),
    [ctx]
  );

  const noop = useCallback(() => {}, []);
  const upsertRequest = useCallback(
    (r: OwnRequest) => setExtraRequests((prev) => [r, ...prev.filter((x) => x.id !== r.id)]),
    []
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
      }}
    >
      <DialogContent className="max-w-xl" closeLabel={t("entry.close")}>
        <DialogHeader>
          <DialogTitle>{t("dialog.logSessionTitle")}</DialogTitle>
        </DialogHeader>
        {ctx ? (
          <KnownTagsProvider custom={tagHistory.custom} counts={tagHistory.counts}>
            <SpotCatalogProvider
              spots={spots}
              requests={requests}
              onAdd={(s) => setExtraSpots((prev) => [...prev, s])}
              onReplace={noop}
              onRemove={noop}
              onRequestChanged={upsertRequest}
            >
              <LogForm
                onCreated={() => {
                  setOpen(false);
                  router.push("/");
                  router.refresh();
                }}
                onBusyChange={setBusy}
                ownerId={ownerId}
                recentSpot={ctx.stats[0]?.spot}
                presetSpot={spot}
                boards={ctx.boards}
                sessions={ctx.stats}
                goal={ctx.goal}
              />
            </SpotCatalogProvider>
          </KnownTagsProvider>
        ) : (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            {failed ? t("dialog.logLoadFailed") : "…"}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
