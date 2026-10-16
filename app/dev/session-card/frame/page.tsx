"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EntryCard } from "@/components/entry-card";
import { DEMO_BOARD, MEDIA_CASES } from "@/app/dev/session-card/media-cases";
import { logAction } from "@/app/dev/fixtures";
import type { Session } from "@/lib/types";

/**
 * One session-card case on its own page, meant to sit inside an <iframe> on
 * /dev/session-card so the card's viewport media queries (sm:, lg:) see the
 * iframe's width. Reports its content height to the parent. Dev only: it is
 * under app/dev, whose layout 404s in production.
 */
const onUpdated = logAction("session-card-frame/onUpdated") as (s: Session) => void;
const onDeleted = logAction("session-card-frame/onDeleted") as (id: string) => void;

function Frame() {
  const params = useSearchParams();
  const c = MEDIA_CASES.find((m) => m.id === params.get("case"));
  const k = params.get("k") ?? "";

  useEffect(() => {
    if (window.parent === window) return;
    const send = () =>
      window.parent.postMessage(
        { type: "session-card-frame-height", k, h: Math.ceil(document.documentElement.scrollHeight) },
        window.location.origin
      );
    const ro = new ResizeObserver(send);
    ro.observe(document.body);
    send();
    return () => ro.disconnect();
  }, [k]);

  if (!c) return <p className="p-4 text-sm">Unknown case</p>;
  return (
    <div className="min-w-0 px-3 pb-3">
      <EntryCard session={c.session} boards={[DEMO_BOARD]} mediaBase="/landing" onUpdated={onUpdated} onDeleted={onDeleted} />
    </div>
  );
}

export default function SessionCardFramePage() {
  return (
    <Suspense>
      <Frame />
    </Suspense>
  );
}
