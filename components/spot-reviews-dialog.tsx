"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang, type TKey } from "@/lib/i18n";
import { MAX_REVIEW_BODY, summarize, type PublicReview, type ReviewSummary } from "@/lib/spot-review";
import type { Spot } from "@/lib/spots";

/** Read and write reviews of one spot (GET/PUT/DELETE /api/spots/:slug/reviews).
 *  Shared: every signed-in user reads every review. One review per user per
 *  spot; posting again replaces it. The spot admin can delete any review. */
export function SpotReviewsDialog({
  spot,
  onOpenChange,
  onSummary,
  draftBody,
}: {
  /** The spot being reviewed; null = closed. */
  spot: Spot | null;
  /** Text to start the review from (the "What you've surfed" private notes):
   *  fills the form, opening it for editing if a review already exists. */
  draftBody?: string;
  onOpenChange: (open: boolean) => void;
  /** Called with the spot's new summary (null = no reviews) after a change. */
  onSummary: (slug: string, summary: ReviewSummary | null) => void;
}) {
  const { lang, t } = useLang();
  const name = spot ? (lang === "zh-TW" ? (spot.nameZh ?? spot.name) : spot.name) : "";
  return (
    <Dialog open={!!spot} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
        <DialogHeader>
          <DialogTitle>{t("review.title", { name })}</DialogTitle>
          <DialogDescription>{t("review.intro")}</DialogDescription>
        </DialogHeader>
        {spot && <Reviews key={spot.slug} spot={spot} onSummary={onSummary} draftBody={draftBody} />}
      </DialogContent>
    </Dialog>
  );
}

const errorKey: Record<string, TKey> = {
  rate_limited: "review.limit",
  unavailable: "review.unavailable",
};

function Reviews({
  spot,
  onSummary,
  draftBody,
}: {
  spot: Spot;
  onSummary: (slug: string, s: ReviewSummary | null) => void;
  draftBody?: string;
}) {
  const { lang, t } = useLang();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  // One review per person per spot, edited in place (like Google Maps): once
  // posted, the form closes and the review shows in the list with Edit / Delete.
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/spots/${encodeURIComponent(spot.slug)}/reviews`;

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setLoadError(t(errorKey[data?.code] ?? "review.failed"));
          return;
        }
        const list = data.reviews as PublicReview[];
        setReviews(list);
        setCanModerate(!!data.canModerate);
        const mine = list.find((r) => r.mine);
        if (mine) {
          setRating(mine.rating);
          setBody(mine.body ?? "");
        }
        // Started from the private notes: the text goes in the form (open for
        // editing if there is already a review); nothing posts until "Post".
        if (draftBody) {
          setBody(draftBody.slice(0, MAX_REVIEW_BODY));
          if (mine) setEditing(true);
        }
      })
      .catch(() => alive && setLoadError(t("review.failed")));
    return () => {
      alive = false;
    };
    // t changes with the language; refetching for that isn't needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const report = (list: PublicReview[]) => {
    const s = summarize(list.map((r) => ({ spot_slug: spot.slug, rating: r.rating })));
    onSummary(spot.slug, s[spot.slug] ?? null);
  };

  const mine = reviews?.find((r) => r.mine) ?? null;
  // Every review, the viewer's own first (it is also editable in the form above).
  const listed = reviews ? [...reviews.filter((r) => r.mine), ...reviews.filter((r) => !r.mine)] : [];

  async function save() {
    if (rating < 1) {
      setError(t("review.pickRating"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(t(errorKey[data?.code] ?? "review.failed"));
        return;
      }
      const review = data.review as PublicReview;
      const next = [review, ...(reviews ?? []).filter((r) => !r.mine)];
      setReviews(next);
      report(next);
      setEditing(false);
      toast.success(t(mine ? "review.updated" : "review.saved"));
    } catch {
      setError(t("review.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${url}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(t(errorKey[data?.code] ?? "review.failed"));
        return;
      }
      const next = (reviews ?? []).filter((r) => r.id !== id);
      setReviews(next);
      report(next);
      if (mine?.id === id) {
        setRating(0);
        setBody("");
      }
      toast.success(t("review.deleted"));
    } catch {
      setError(t("review.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div role="alert" className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">
        {loadError}
      </div>
    );
  }
  if (!reviews) return <p className="text-[13.5px] text-muted-foreground">{t("review.loading")}</p>;

  const showForm = !mine || editing;

  function startEdit() {
    if (!mine) return;
    setRating(mine.rating);
    setBody(mine.body ?? "");
    setError(null);
    setEditing(true);
  }

  return (
    <div className="flex flex-col gap-5">
      {showForm && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void save();
          }}
        >
          <h3 className="pl-0.5 text-xs font-semibold text-muted-foreground">{t(mine ? "review.editYours" : "review.yours")}</h3>
          <StarInput value={rating} onChange={(v) => (setRating(v), setError(null))} />
          {draftBody && <p className="text-[12.5px] leading-relaxed text-muted-foreground">{t("review.fromNotes")}</p>}
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">{t("review.body")}</span>
            <Textarea
              value={body}
              maxLength={MAX_REVIEW_BODY}
              rows={3}
              placeholder={t("review.bodyPlaceholder")}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          {error && (
            <div role="alert" className="rounded-xl bg-secondary px-3.5 py-3 text-[13px] leading-relaxed">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={busy || rating < 1} className="rounded-full px-6">
              {busy ? t("review.saving") : mine ? t("review.update") : t("review.save")}
            </Button>
            {mine && (
              <Button type="button" variant="ghost" disabled={busy} className="rounded-full" onClick={() => (setEditing(false), setError(null))}>
                {t("review.cancel")}
              </Button>
            )}
          </div>
        </form>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="pl-0.5 text-xs font-semibold text-muted-foreground">
          {t("review.all")} <span className="font-mono">{listed.length}</span>
        </h3>
        {listed.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">{t("review.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-card-border rounded-[var(--r-tile)] border border-card-border">
            {listed.filter((r) => !(r.mine && editing)).map((r) => (
              <li key={r.id} className="flex gap-3 px-3.5 py-3">
                <Avatar name={r.authorName || t("review.anonymous")} image={r.authorImage} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 text-[13.5px] font-semibold break-words">{r.authorName || t("review.anonymous")}</span>
                    {r.mine && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{t("review.you")}</span>
                    )}
                    <Stars value={r.rating} />
                    <span className="font-mono text-[11.5px] text-muted-foreground">{fmtDay(r.updatedAt, lang)}</span>
                    {canModerate && !r.mine && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(r.id)}
                        className="ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold text-destructive outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {t("review.delete")}
                      </button>
                    )}
                  </div>
                  {r.body && <p className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line break-words">{r.body}</p>}
                  {r.mine && (
                    <div className="mt-2 flex gap-1.5">
                      <Button type="button" size="sm" variant="secondary" disabled={busy} className="rounded-full px-3.5" onClick={startEdit}>
                        {t("review.edit")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={busy} className="rounded-full px-3.5 text-destructive" onClick={() => void remove(r.id)}>
                        {t("review.delete")}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The author's Google avatar, or their initial in a grey circle. */
function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a Google avatar URL, not a local asset
      <img src={image} alt="" width={32} height={32} referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-badge text-[13px] font-semibold text-badge-foreground">
      {[...name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}

const fmtDay = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(lang === "zh-TW" ? "zh-TW" : "en", { year: "numeric", month: "short", day: "numeric" });

/** Read-only stars, e.g. on a review or a spot row. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const { t } = useLang();
  const full = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={t("review.stars", { count: value })}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3.5", i <= full ? "fill-primary text-primary" : "fill-transparent text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

/** Five star buttons acting as one radio group. */
function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useLang();
  return (
    <div role="radiogroup" aria-label={t("review.rating")} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={t("review.stars", { count: i })}
          onClick={() => onChange(i)}
          className="flex size-9 items-center justify-center rounded-full outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Star
            aria-hidden
            className={cn("size-6", i <= value ? "fill-primary text-primary" : "fill-transparent text-muted-foreground/50")}
          />
        </button>
      ))}
    </div>
  );
}
