"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Photo } from "@/lib/types";

// Square dark-grey buttons top right, as in Strava's lightbox (2026-10-16).
const squareButton =
  "flex size-11 items-center justify-center rounded-[6px] bg-[#222] text-white outline-none transition-colors hover:bg-[#333] focus-visible:ring-2 focus-visible:ring-white disabled:opacity-35 disabled:hover:bg-[#222] motion-reduce:transition-none";
const edgeButton =
  "absolute top-1/2 z-10 flex h-20 w-11 -translate-y-1/2 items-center justify-center bg-black/45 text-white outline-none transition-colors hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white motion-reduce:transition-none";
const ZOOMS = [1, 2, 3];

/**
 * Full-screen view of a session's photos and videos, opened from the card's
 * media mosaic. `index` is which one is showing (null = closed). Items sit
 * side by side and the row slides (280ms ease-out; instant under reduced
 * motion); a horizontal pointer drag moves it with the finger and snaps on
 * release, ←/→ and the edge strips step too, with no wrap-around. Only the
 * current item and its neighbours are mounted, so neighbouring photos are
 * already loaded when you move. Photos zoom 1x/2x/3x with drag-to-pan
 * (reset on switching); a video keeps its native controls and pauses when
 * you leave it. Escape, the X or the dark area closes.
 */
export function MediaViewer({
  photos,
  index: indexProp,
  onIndexChange,
  alt,
  mediaBase = "/api/blob",
  returnFocusRef,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Alt text for a photo (the session's spot and time). */
  alt: string;
  /** Where the files load from (see EntryCard's `mediaBase`). */
  mediaBase?: string;
  /** The element that opened the viewer; focused again on close (Safari doesn't focus buttons on click, so Radix's own restore lands on body). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const { t } = useLang();
  const open = indexProp !== null && indexProp < photos.length;
  // Radix keeps the content mounted for the fade-out after `index` goes
  // null; render from the last real index meanwhile so the photo, zoom
  // buttons and counter fade out with the black instead of blanking first.
  const [lastIndex, setLastIndex] = useState<number | null>(indexProp);
  if (indexProp !== null && lastIndex !== indexProp) setLastIndex(indexProp);
  const index = indexProp ?? lastIndex;
  const count = photos.length;
  const closeRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0); // px the row is dragged by the finger
  const [dragging, setDragging] = useState(false);
  const [zoomStep, setZoomStep] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const gesture = useRef<{
    id: number;
    x: number;
    y: number;
    t: number;
    mode: "none" | "swipe" | "pan";
    panX: number;
    panY: number;
  } | null>(null);
  const moved = useRef(false);
  const zoom = ZOOMS[zoomStep];

  // Reset zoom and pan whenever the item changes (adjusting state during
  // render, React's documented pattern, rather than an effect).
  const [seen, setSeen] = useState(index);
  if (seen !== index) {
    setSeen(index);
    setZoomStep(0);
    setPan({ x: 0, y: 0 });
    setDrag(0);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange]);

  // Pause a video as soon as it is no longer the current item.
  useEffect(() => {
    stageRef.current?.querySelectorAll("video").forEach((v) => {
      if (v.dataset.current !== "true") v.pause();
    });
  });

  const current = index !== null && index < photos.length ? photos[index] : null;
  const currentIsVideo = !!current?.type.startsWith("video/");

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const el = e.target as HTMLElement;
    // Leave a video's controls bar alone so scrubbing keeps working.
    if (el instanceof HTMLVideoElement) {
      const r = el.getBoundingClientRect();
      if (e.clientY > r.bottom - 64) return;
    }
    if (el.closest("button")) return;
    moved.current = false;
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: e.timeStamp,
      mode: "none",
      panX: pan.x,
      panY: pan.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || index === null) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.mode === "none") {
      if (Math.hypot(dx, dy) < 8) return;
      if (zoom > 1 && !currentIsVideo) g.mode = "pan";
      else if (Math.abs(dx) > Math.abs(dy)) g.mode = "swipe";
      else {
        gesture.current = null;
        return;
      }
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    if (g.mode === "pan") {
      const w = stageRef.current?.clientWidth ?? 0;
      const h = stageRef.current?.clientHeight ?? 0;
      const lx = (w * (zoom - 1)) / 2;
      const ly = (h * (zoom - 1)) / 2;
      setPan({
        x: Math.max(-lx, Math.min(lx, g.panX + dx)),
        y: Math.max(-ly, Math.min(ly, g.panY + dy)),
      });
    } else {
      // Rubber-band at the first and last item.
      const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
      setDrag(atEdge ? dx * 0.25 : dx);
    }
  }

  function endGesture(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (g.mode === "swipe" && index !== null) {
      const dx = e.clientX - g.x;
      const w = stageRef.current?.clientWidth ?? 1;
      const fast = Math.abs(dx) / Math.max(1, e.timeStamp - g.t) > 0.5;
      if ((Math.abs(dx) > w * 0.25 || fast) && dx < 0 && index < count - 1)
        onIndexChange(index + 1);
      else if ((Math.abs(dx) > w * 0.25 || fast) && dx > 0 && index > 0)
        onIndexChange(index - 1);
    }
    setDrag(0);
  }

  function setZoom(step: number) {
    const next = Math.max(0, Math.min(ZOOMS.length - 1, step));
    setZoomStep(next);
    if (next === 0) setPan({ x: 0, y: 0 });
  }

  const slides: number[] = [];
  if (index !== null)
    for (
      let i = Math.max(0, index - 1);
      i <= Math.min(count - 1, index + 1);
      i++
    )
      slides.push(i);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => !o && onIndexChange(null)}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 overflow-hidden outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none"
          onCloseAutoFocus={(e) => {
            const el = returnFocusRef?.current;
            if (el && el.isConnected) {
              e.preventDefault();
              el.focus();
            }
          }}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            closeRef.current?.focus();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("viewer.title")}
          </DialogPrimitive.Title>

          <div
            ref={stageRef}
            className="absolute inset-0 touch-pan-y select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            // a tap on the black area around the picture closes
            onClick={(e) => {
              if (e.target === e.currentTarget && !moved.current)
                onIndexChange(null);
            }}
          >
            {slides.map((i) => {
              const p = photos[i];
              const isCurrent = i === index;
              const isVideo = p.type.startsWith("video/");
              return (
                <div
                  key={p.id}
                  aria-hidden={!isCurrent}
                  className={`absolute inset-0 flex items-center justify-center px-3 sm:px-16 ${
                    dragging
                      ? ""
                      : "transition-transform duration-[280ms] ease-out motion-reduce:transition-none"
                  }`}
                  style={{
                    transform: `translateX(calc(${(i - (index ?? 0)) * 100}% + ${drag}px))`,
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget && !moved.current)
                      onIndexChange(null);
                  }}
                >
                  {isVideo ? (
                    isCurrent ? (
                      <video
                        src={`${mediaBase}/${p.id}`}
                        data-current="true"
                        controls
                        autoPlay
                        playsInline
                        className="max-h-full max-w-full bg-black"
                      />
                    ) : null
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${mediaBase}/${p.id}`}
                      alt={isCurrent ? alt : ""}
                      draggable={false}
                      className={`max-h-full max-w-full object-contain ${
                        dragging
                          ? ""
                          : "transition-transform duration-200 ease-out motion-reduce:transition-none"
                      }`}
                      style={
                        isCurrent
                          ? {
                              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                              cursor: zoom > 1 ? "grab" : undefined,
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute top-6 right-6 z-10 flex gap-1.5">
            {!currentIsVideo && (
              <>
                <button
                  type="button"
                  aria-label={t("viewer.zoomIn")}
                  disabled={zoomStep === ZOOMS.length - 1}
                  onClick={() => setZoom(zoomStep + 1)}
                  className={squareButton}
                >
                  <ZoomIn className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={t("viewer.zoomOut")}
                  disabled={zoomStep === 0}
                  onClick={() => setZoom(zoomStep - 1)}
                  className={squareButton}
                >
                  <ZoomOut className="size-5" aria-hidden />
                </button>
              </>
            )}
            <DialogPrimitive.Close ref={closeRef} className={squareButton}>
              <X className="size-5" aria-hidden />
              <span className="sr-only">{t("entry.close")}</span>
            </DialogPrimitive.Close>
          </div>

          {index !== null && index > 0 && (
            <button
              type="button"
              aria-label={t("viewer.prev")}
              onClick={() => onIndexChange(index - 1)}
              className={`${edgeButton} left-0 rounded-r-[6px]`}
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          )}
          {index !== null && index < count - 1 && (
            <button
              type="button"
              aria-label={t("viewer.next")}
              onClick={() => onIndexChange(index + 1)}
              className={`${edgeButton} right-0 rounded-l-[6px]`}
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          )}
          {count > 1 && index !== null && (
            <span className="absolute right-6 bottom-5 z-10 font-mono text-xs text-white">
              {index + 1} / {count}
            </span>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
