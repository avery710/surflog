"use client";

import { useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  SKILLS,
  REACTIONS,
  clipAround,
  clipNeedsSkillPick,
  clipsBySkill,
  fmtClock,
  MIN_CLIP_MS,
  sessionVideo,
  type Clip,
  type Reaction,
  type Skill,
} from "@/lib/clips";
import { fmtWhen } from "@/lib/format";
import { useLang, type TKey } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";
import { useSpotCatalog } from "@/lib/spot-catalog";
import type { Session } from "@/lib/types";
import { cn } from "cn";

const SKILL_KEY: Record<Skill, TKey> = {
  takeoff: "clip.skill.takeoff",
  bottom_turn: "clip.skill.bottom_turn",
  trim: "clip.skill.trim",
  cutback: "clip.skill.cutback",
  other: "clip.skill.other",
  not_a_ride: "clip.skill.not_a_ride",
};

const REACTION_KEY: Record<Reaction, TKey> = {
  nailed_it: "clip.reaction.nailed_it",
  late: "clip.reaction.late",
  fell: "clip.reaction.fell",
  not_sure: "clip.reaction.not_sure",
};

/** Skills the surfer picks. "Not a ride" is the dismiss button, not a chip. */
const PICKABLE = SKILLS.filter((s) => s !== "not_a_ride");

/**
 * Review one session video: play a clip, drag its ends, label the skill,
 * tap a reaction, confirm. Confirmed clips group by skill. `preview` keeps
 * every change in memory (the /dev page); the real page writes to the API.
 */
export function ClipReview({
  session,
  initialClips,
  ready = true,
  preview = false,
  durationHintMs,
}: {
  session: Session;
  initialClips: Clip[];
  /** False when the clips table isn't there yet. */
  ready?: boolean;
  preview?: boolean;
  /** Used when there is no real video element (the dev preview). */
  durationHintMs?: number;
}) {
  const { t, lang } = useLang();
  const catalog = useSpotCatalog();
  const videoRef = useRef<HTMLVideoElement>(null);
  const video = sessionVideo(session.photos);
  const [clips, setClips] = useState(initialClips);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialClips.find((c) => !c.confirmed)?.id ?? initialClips[0]?.id ?? null
  );
  const [durationMs, setDurationMs] = useState(durationHintMs ?? 0);
  const [playheadMs, setPlayheadMs] = useState(
    () => (initialClips.find((c) => !c.confirmed) ?? initialClips[0])?.startMs ?? 0
  );
  const [drag, setDrag] = useState<{ startMs: number; endMs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const playing = useRef(false);

  function selectClip(id: string) {
    setSelectedId(id);
    const clip = clips.find((c) => c.id === id);
    if (!clip) return;
    setDrag(null);
    setPlayheadMs(clip.startMs);
    if (videoRef.current) videoRef.current.currentTime = clip.startMs / 1000;
  }

  const selected = clips.find((c) => c.id === selectedId) ?? null;
  const startMs = drag?.startMs ?? selected?.startMs ?? 0;
  const endMs = drag?.endMs ?? selected?.endMs ?? 0;
  const unsure = selected ? clipNeedsSkillPick(selected) : false;
  const queue = clips.filter((c) => !c.confirmed);
  const groups = clipsBySkill(clips);

  function upsert(clip: Clip) {
    setClips((prev) => {
      const i = prev.findIndex((c) => c.id === clip.id);
      if (i === -1) return [...prev, clip].sort((a, b) => a.startMs - b.startMs);
      const next = prev.slice();
      next[i] = clip;
      return next;
    });
    setSelectedId(clip.id);
  }

  async function write(clip: Clip, path: string, method: string, body?: unknown): Promise<Clip | null> {
    if (preview) return clip;
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.clip) throw new Error(json?.error || "failed");
      return json.clip as Clip;
    } catch {
      toast.error(t("clip.failed"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function patch(
    partial: Partial<Pick<Clip, "startMs" | "endMs" | "skill" | "reaction" | "confirmed">>
  ) {
    if (!selected) return;
    const optimistic: Clip = {
      ...selected,
      ...partial,
      taggedBy:
        partial.skill !== undefined && (partial.skill !== selected.skill || clipNeedsSkillPick(selected))
          ? "user"
          : selected.taggedBy,
    };
    upsert(optimistic);
    const saved = await write(optimistic, `/api/clips/${selected.id}`, "PATCH", partial);
    if (saved) upsert(saved);
    else if (!preview) upsert(selected);
  }

  function playClip() {
    if (!selected) return;
    playing.current = true;
    const node = videoRef.current;
    if (!node) {
      setPlayheadMs(startMs);
      return;
    }
    node.currentTime = startMs / 1000;
    void node.play().catch(() => {
      playing.current = false;
    });
  }

  function onTime(node: HTMLVideoElement) {
    const ms = node.currentTime * 1000;
    setPlayheadMs(ms);
    if (playing.current && selected && ms >= (drag?.endMs ?? selected.endMs) - 40) {
      node.pause();
      playing.current = false;
    }
  }

  async function addClip() {
    if (!video || durationMs < 1) return;
    const span = clipAround(playheadMs, durationMs);
    if (!span) return;
    const optimistic: Clip = {
      id: preview ? `local-${Date.now()}` : "pending",
      ownerId: session.ownerId,
      sessionId: session.id,
      mediaId: video.id,
      startMs: span.startMs,
      endMs: span.endMs,
      skill: "other",
      taggedBy: "user",
      model: null,
      confidence: null,
      confirmed: false,
      reaction: null,
      createdAt: new Date().toISOString(),
    };
    if (preview) {
      upsert(optimistic);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: video.id,
          startMs: span.startMs,
          endMs: span.endMs,
          skill: "other",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.clip) throw new Error();
      upsert(json.clip as Clip);
    } catch {
      toast.error(t("clip.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeClip() {
    if (!selected) return;
    const id = selected.id;
    setClips((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    if (preview) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/clips/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      toast.error(t("clip.failed"));
      upsert(selected);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${PAGE_COLUMN} py-4 sm:py-6`}>
      <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--on-page)]">
        <ChevronLeft className="size-3.5" aria-hidden />
        {t("clip.back")}
      </Link>
      <h1 className="mt-2 flex flex-wrap items-baseline gap-x-3">
        <span className="text-[21px] font-bold tracking-[-0.02em]">{catalog.label(session.spot, lang)}</span>
        <span className="text-[13px] font-medium tabular-nums">{fmtWhen(session.when, lang, session.durationMin)}</span>
      </h1>

      {!video ? (
        <p className="mt-6 text-[15px] font-bold text-[var(--on-page)]">{t("clip.noVideo")}</p>
      ) : (
        <div className="mt-4 rounded-[var(--r-card)] surface-card p-4 sm:p-6">
          {preview ? (
            <div className="flex h-40 items-center justify-center rounded-[var(--r-tile)] bg-secondary text-[13px] font-medium text-muted-foreground">
              {fmtClock(playheadMs)}
            </div>
          ) : (
            <video
              ref={videoRef}
              src={`/api/blob/${video.id}`}
              controls
              playsInline
              preload="metadata"
              className="max-h-[420px] w-full rounded-[var(--r-tile)] bg-black"
              onLoadedMetadata={(e) => setDurationMs(e.currentTarget.duration * 1000)}
              onTimeUpdate={(e) => onTime(e.currentTarget)}
              onPause={() => {
                playing.current = false;
              }}
            />
          )}

          {durationMs > 0 && selected && (
            <Timeline
              durationMs={durationMs}
              startMs={startMs}
              endMs={endMs}
              playheadMs={playheadMs}
              startLabel={t("clip.start")}
              endLabel={t("clip.end")}
              onSeek={(ms) => {
                setPlayheadMs(ms);
                if (videoRef.current) videoRef.current.currentTime = ms / 1000;
              }}
              onDrag={setDrag}
              onCommit={(span) => {
                setDrag(null);
                if (span.startMs !== selected.startMs || span.endMs !== selected.endMs) {
                  void patch({ startMs: span.startMs, endMs: span.endMs });
                }
              }}
            />
          )}

          {selected && (
            <div className="mt-4">
              <p className="font-mono text-[13px] text-muted-foreground">
                {fmtClock(startMs)}–{fmtClock(endMs)}
                {selected.confidence != null && selected.taggedBy === "ai" && (
                  <span className="ml-2">{Math.round(selected.confidence * 100)}%</span>
                )}
              </p>
              {unsure ? (
                <p className="mt-2 text-[15px] font-bold">{t("clip.unsure")}</p>
              ) : (
                <p className="mt-2 text-[15px] font-bold">{t(SKILL_KEY[selected.skill])}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("clip.bySkill")}>
                {PICKABLE.map((skill) => {
                  const on = !unsure && selected.skill === skill;
                  return (
                    <button
                      key={skill}
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => void patch({ skill })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[13px] font-medium",
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_4%)]"
                      )}
                    >
                      {t(SKILL_KEY[skill])}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("clip.reaction")}>
                {REACTIONS.map((reaction) => {
                  const on = selected.reaction === reaction;
                  return (
                    <button
                      key={reaction}
                      type="button"
                      aria-pressed={on}
                      disabled={busy}
                      onClick={() => void patch({ reaction: on ? null : reaction })}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[13px] font-medium",
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_4%)]"
                      )}
                    >
                      {t(REACTION_KEY[reaction])}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="rounded-full" disabled={busy} onClick={playClip}>
                  {t("clip.play")}
                </Button>
                <Button
                  type="button"
                  className="rounded-full"
                  disabled={busy || unsure || selected.confirmed}
                  onClick={() => void patch({ confirmed: true })}
                >
                  {t("clip.confirm")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => void patch({ skill: "not_a_ride", confirmed: true })}
                >
                  {t("clip.notARide")}
                </Button>
                <Button type="button" variant="ghost" className="rounded-full" disabled={busy} onClick={() => void removeClip()}>
                  {t("clip.remove")}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4">
            <Button type="button" variant="secondary" className="rounded-full" disabled={busy || !ready || durationMs < 1} onClick={() => void addClip()}>
              {t("clip.add")}
            </Button>
            {!ready && <p className="mt-2 text-[13px] text-muted-foreground">{t("clip.notReady")}</p>}
          </div>
        </div>
      )}

      <section className="mt-6">
        <h2 className="pl-1 text-[13px] font-bold text-[var(--on-page)]">{t("clip.toReview")}</h2>
        {queue.length === 0 ? (
          <p className="mt-2 pl-1 text-[13px] text-[var(--on-page)]">{clips.length === 0 ? t("clip.empty") : t("clip.reviewed")}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {queue.map((clip) => (
              <li key={clip.id}>
                <ClipRow clip={clip} selected={clip.id === selectedId} onSelect={() => selectClip(clip.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.length > 0 && (
        <section className="mt-6">
          <h2 className="pl-1 text-[13px] font-bold text-[var(--on-page)]">{t("clip.bySkill")}</h2>
          <div className="mt-2 flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.skill}>
                <h3 className="pl-1 text-[13px] font-medium text-[var(--on-page)]">
                  {t(SKILL_KEY[group.skill])}
                  <span className="ml-2 font-mono text-[11px]">{group.clips.length}</span>
                </h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {group.clips.map((clip) => (
                    <li key={clip.id}>
                      <ClipRow clip={clip} selected={clip.id === selectedId} onSelect={() => selectClip(clip.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ClipRow({ clip, selected, onSelect }: { clip: Clip; selected: boolean; onSelect: () => void }) {
  const { t } = useLang();
  const unsure = clipNeedsSkillPick(clip);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--r-tile)] px-3 py-2 text-left",
        selected ? "bg-secondary" : "hover:bg-[color-mix(in_oklch,var(--secondary),transparent_30%)]"
      )}
    >
      <span className="font-mono text-[13px] tabular-nums">
        {fmtClock(clip.startMs)}–{fmtClock(clip.endMs)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
        {unsure ? t("clip.unsure") : t(SKILL_KEY[clip.skill])}
      </span>
      {clip.reaction && (
        <span className="shrink-0 text-[12px] text-muted-foreground">{t(REACTION_KEY[clip.reaction])}</span>
      )}
    </button>
  );
}

function Timeline({
  durationMs,
  startMs,
  endMs,
  playheadMs,
  startLabel,
  endLabel,
  onSeek,
  onDrag,
  onCommit,
}: {
  durationMs: number;
  startMs: number;
  endMs: number;
  playheadMs: number;
  startLabel: string;
  endLabel: string;
  onSeek: (ms: number) => void;
  onDrag: (span: { startMs: number; endMs: number }) => void;
  onCommit: (span: { startMs: number; endMs: number }) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const frac = (ms: number) => Math.min(1, Math.max(0, ms / durationMs));

  function msAt(clientX: number): number {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.round(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * durationMs);
  }

  function dragHandle(which: "start" | "end", event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    let span = { startMs, endMs };
    const move = (e: globalThis.PointerEvent) => {
      const at = msAt(e.clientX);
      span =
        which === "start"
          ? { startMs: Math.min(at, endMs - MIN_CLIP_MS), endMs }
          : { startMs, endMs: Math.max(at, startMs + MIN_CLIP_MS) };
      span = {
        startMs: Math.max(0, span.startMs),
        endMs: Math.min(durationMs, span.endMs),
      };
      onDrag(span);
    };
    const up = (e: globalThis.PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      onCommit(span);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={bar}
      className="relative mt-3 h-8 cursor-pointer rounded-full bg-secondary"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        onSeek(msAt(e.clientX));
      }}
    >
      <div
        className="absolute top-0 h-full rounded-full bg-primary/20"
        style={{ left: `${frac(startMs) * 100}%`, width: `${(frac(endMs) - frac(startMs)) * 100}%` }}
      />
      <div className="absolute top-0 h-full w-px bg-foreground" style={{ left: `${frac(playheadMs) * 100}%` }} />
      <Handle label={startLabel} at={frac(startMs)} value={startMs} max={durationMs} onDown={(e) => dragHandle("start", e)} />
      <Handle label={endLabel} at={frac(endMs)} value={endMs} max={durationMs} onDown={(e) => dragHandle("end", e)} />
    </div>
  );
}

function Handle({
  label,
  at,
  value,
  max,
  onDown,
}: {
  label: string;
  at: number;
  value: number;
  max: number;
  onDown: (e: PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={fmtClock(value)}
      onPointerDown={onDown}
      className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-sm"
      style={{ left: `${at * 100}%` }}
    />
  );
}
