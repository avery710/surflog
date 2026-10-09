/**
 * Draws the landing page's share stickers (section 05,
 * components/landing/share-showcase.tsx) with the real renderer,
 * lib/share-image.tsx, from the landing's own demo session
 * (components/landing/demo-data.ts), and writes them to public/landing/
 * as share-<variant>-<lang, lower case>.webp (540x960; proxy.ts lets only
 * lower-case names through). Re-run after the share images change:
 *
 *   npx tsx scripts/landing-share-images.ts
 *
 * Static files rather than the element in the DOM because the strip's
 * cut-out text is a pixel step after rasterising (lib/share-knockout.ts),
 * which the browser can't do. Fonts come from Google Fonts at run time.
 * SYNTHETIC ONLY: no database, no real session.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { DICT } from "../lib/i18n";
import { buildShareCard } from "../lib/share-card-data";
import { renderShareImage } from "../lib/share-image";
import { spotLabel } from "../lib/format";
import { TAIWAN_SPOTS_FIXTURE } from "../lib/spot-fixtures";
import { DEMO_BOARDS, demoSessions } from "../components/landing/demo-data";
import type { ShareLang } from "../lib/share-strings";

const VARIANTS = ["strip", "column", "card"] as const;
const LANGS: ShareLang[] = ["en", "zh-TW"];
/** The hero session is "yesterday" of this date; fixed so re-runs match. */
const TODAY = "2026-10-09";

async function main() {
  const pub = path.join(process.cwd(), "public");
  const board = DEMO_BOARDS.find((b) => b.id === "demo-board-3")!;
  const photo = await sharp(await readFile(path.join(pub, board.photoUrl!)))
    .resize(160, 160, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer();
  const boardPhoto = `data:image/jpeg;base64,${photo.toString("base64")}`;

  for (const lang of LANGS) {
    const t = (k: keyof typeof DICT) => DICT[k][lang];
    const notes = t("landing.demo.notes");
    const { hero } = demoSessions(TODAY, {
      notesHtml: `<p>${notes}</p>`,
      notes,
      goal: [t("landing.demo.goal1"), t("landing.demo.goal2"), t("landing.demo.goal3")].join("\n"),
    });
    const data = {
      ...buildShareCard({
        session: hero,
        spot: TAIWAN_SPOTS_FIXTURE.find((s) => s.slug === hero.spot),
        spotName: spotLabel(hero.spot, lang),
        board,
        lang,
      }),
      boardPhoto,
    };
    for (const variant of VARIANTS) {
      // The full 1080x1920 story frame, as the share dialog makes it, with no
      // photo (transparent around the sticker): the page lays it over its own
      // photo stand-in, so the sticker sits where it would in a story.
      const res = await renderShareImage(data, variant, { cacheControl: "no-store", tone: "light", storyFrame: true });
      const png = Buffer.from(await res.arrayBuffer());
      const out = path.join(pub, "landing", `share-${variant}-${lang.toLowerCase()}.webp`);
      // Shown at most ~280px wide, so half size is enough for a 2x screen.
      await sharp(png).resize({ width: 540 }).webp({ quality: 90, alphaQuality: 90 }).toFile(out);
      console.log(out);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
