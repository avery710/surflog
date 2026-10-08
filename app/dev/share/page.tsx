import { SHARE_CASES, shareCaseData } from "@/app/dev/share/cases";
import { PublicShareView } from "@/components/share/public-share-view";
import { toPublicShare } from "@/lib/share-public";
import type { ShareLang } from "@/lib/share-strings";

/**
 * Showcase for the share feature — see CLAUDE.md "Share a session". Every
 * case goes through the real code: lib/share-card-data.ts builds the data,
 * /dev/share/image draws it with lib/share-image.tsx (the same renderer the
 * owner and public routes use), and the public page is the real
 * PublicShareView on a PublicShare built by toPublicShare().
 *
 * Limits: no photos/videos (the media route is token-scoped; deliberately not
 * faked), and the PNGs are fetched from the dev route on first view, which
 * downloads font subsets from Google Fonts (a second or two the first time).
 * Stickers sit on a checkerboard so their transparency is visible, and on a
 * light and a dark patch to judge legibility.
 */
const LANGS: ShareLang[] = ["en", "zh-TW"];

const CHECKER =
  "[background-image:conic-gradient(#e5e7eb_25%,#f9fafb_0_50%,#e5e7eb_0_75%,#f9fafb_0)] bg-[length:20px_20px]";

function img(caseId: string, variant: string, lang: ShareLang, tone = "light", parts?: string) {
  return `/dev/share/image?case=${caseId}&variant=${variant}&lang=${lang}&tone=${tone}${parts ? `&parts=${parts}` : ""}`;
}

export default function DevSharePage() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4.5 py-8">
      <h1 className="font-sans text-2xl font-extrabold">Share images and public page</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Synthetic sessions only. Each case: the text-only strip and column in light and dark tones (on photo stand-ins and a checkerboard), a parts-off example, the solid
        card, the link-preview image, and the public page.
      </p>

      {SHARE_CASES.map((c) => (
        <section key={c.id} className="mt-10">
          <h2 className="text-lg font-bold">{c.title}</h2>
          <p className="font-mono text-xs text-muted-foreground">{c.id}</p>
          {LANGS.map((lang) => {
            const data = shareCaseData(c.id, lang);
            if (!data) return null;
            const view = toPublicShare(c.session, data, { owner_name: "Avery Lin", owner_image: null });
            return (
              <div key={lang} className="mt-4 rounded-[var(--r-card)] border border-card-border p-4">
                <h3 className="text-sm font-bold">{lang}</h3>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Strip, light (white text) on dark</figcaption>
                    <div className="rounded-lg bg-[linear-gradient(135deg,#0b1220,#1d3b4a)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "strip", lang, "light")} alt="" className="w-full" />
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Strip, dark (near-black text) on bright</figcaption>
                    <div className="rounded-lg bg-[linear-gradient(135deg,#f6f1c8,#9fd8ee)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "strip", lang, "dark")} alt="" className="w-full" />
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Card (sticker: transparent around it)</figcaption>
                    <div className="rounded-lg bg-[linear-gradient(135deg,#0b1220,#1d3b4a)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "card", lang)} alt="" className="w-full" />
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Column, light on dark</figcaption>
                    <div className="rounded-lg bg-[linear-gradient(135deg,#0b1220,#1d3b4a)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "column", lang, "light")} alt="" className="w-full" />
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Column, dark on bright</figcaption>
                    <div className="rounded-lg bg-[linear-gradient(135deg,#f6f1c8,#9fd8ee)] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "column", lang, "dark")} alt="" className="w-full" />
                    </div>
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Strip on a checkerboard (transparent), parts: board + log only (date and waves off, the spot always stays)</figcaption>
                    <div className={`rounded-lg p-2 ${CHECKER}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img(c.id, "strip", lang, "light", "board,log")} alt="" className="w-full" />
                    </div>
                  </figure>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Link preview (og, 1200x630)</figcaption>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(c.id, "og", lang)} alt="" className="w-full rounded-lg" />
                  </figure>
                  <figure>
                    <figcaption className="mb-1 text-xs font-semibold">Public page</figcaption>
                    <div className="h-[560px] overflow-auto rounded-lg border border-card-border [&>div]:min-h-0">
                      <PublicShareView share={view} />
                    </div>
                  </figure>
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
