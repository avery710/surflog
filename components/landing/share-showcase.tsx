"use client";

import { useMemo } from "react";
import { Link2 } from "lucide-react";
import { buildShareCard, type ShareCardData } from "@/lib/share-card-data";
import { layoutShare, shareElement, type ShareFontFamilies, type ShareLogos, type ShareVariant } from "@/lib/share-element";
import { boardPhotoSrc } from "@/lib/boards";
import { spotLabel } from "@/lib/format";
import { TAIWAN_SPOTS_FIXTURE } from "@/lib/spot-fixtures";
import { useLang } from "@/lib/i18n";
import type { Board, Session } from "@/lib/types";

const FONTS: ShareFontFamilies = {
  sans: "var(--font-sans), sans-serif",
  mono: "var(--font-mono), monospace",
};

const LOGOS: ShareLogos = { black: "/surflog-logo.png", white: "/surflog-logo-white.png" };

/**
 * Landing section 05. The images are the real share element
 * (lib/share-element.tsx, the one the PNG routes draw) put straight into the
 * DOM, built from the demo session — no image route, no API call.
 */
export function ShareShowcase({ session, boards }: { session: Session; boards: Board[] }) {
  const { lang, t } = useLang();
  const data = useMemo(
    () => {
      const board = boards.find((b) => b.id === session.boardId) ?? null;
      return {
        ...buildShareCard({
          session,
          spot: TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === session.spot),
          spotName: spotLabel(session.spot, lang),
          board,
          lang,
        }),
        // The demo board's photo is a public landing file, fine to show.
        boardPhoto: board ? boardPhotoSrc(board) : null,
      };
    },
    [session, boards, lang]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Tile label={t("share.variant.strip")} note={t("share.variant.stripNote")}>
          <Photo>
            <Scaled data={data} variant="strip" label={t("share.preview.alt")} />
          </Photo>
        </Tile>
      </div>
      <Tile label={t("share.variant.column")} note={t("share.variant.columnNote")}>
        <Photo>
          <Scaled data={data} variant="column" label={t("share.preview.alt")} />
        </Photo>
      </Tile>
      <Tile label={t("share.variant.card")} note={t("share.variant.cardNote")}>
        <Photo>
          <Scaled data={data} variant="card" label={t("share.preview.alt")} />
        </Photo>
      </Tile>
      <div className="grid items-center gap-5 rounded-[var(--r-card)] border border-card-border bg-card p-5 sm:col-span-2 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-bold">
            <Link2 className="size-4.5 text-primary" aria-hidden />
            {t("share.link.title")}
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{t("landing.share.linkBody")}</p>
        </div>
        <div className="overflow-hidden rounded-[var(--r-tile)]">
          <Scaled data={data} variant="og" label={t("share.preview.alt")} />
        </div>
      </div>
    </div>
  );
}

/** Stands in for the visitor's own photo: sky, sea, sand. */
function Photo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end overflow-hidden rounded-[var(--r-tile)] bg-[linear-gradient(180deg,#2f6f9f_0%,#3f86b5_40%,#1d5f93_41%,#164a75_80%,#8a7a5a_100%)]">
      {children}
    </div>
  );
}

function Tile({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-[var(--r-card)] border border-card-border bg-card p-5">
      <p className="text-[14px] font-bold">{label}</p>
      <p className="mt-1 mb-4 text-[14px] leading-relaxed text-muted-foreground">{note}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

/** The element is laid out in image pixels; the SVG viewBox scales it to the
 *  box's width. (CSS-only `scale: tan(atan2(100cqw, 1080px))` was tried first:
 *  WebKit mixes degrees and radians there and draws it at the wrong size.) */
function Scaled({ data, variant, label }: { data: ShareCardData; variant: ShareVariant; label: string }) {
  const layout = layoutShare(data, variant);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${layout.width} ${layout.height}`} className="block h-auto w-full">
      <foreignObject width={layout.width} height={layout.height}>
        {shareElement(data, variant, layout, { fonts: FONTS, logos: LOGOS, tone: "light" })}
      </foreignObject>
    </svg>
  );
}
