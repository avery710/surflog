import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

/**
 * DEV-ONLY: the page glow (blue + green orbs, app/globals.css `.page-glow`) in
 * seven colour pairs, same shape and size as the real one, each behind the same
 * mock page (glass header, two see-through cards). Pick one; its two colours and
 * strengths then go into `.page-glow-sky` / `.page-glow-mint`. 404s in production.
 * `rgb` is the orb colour, `a` its strength at the centre (it fades to nothing by 68%).
 */
const OPTIONS: { n: string; name: string; sky: [string, number]; mint: [string, number]; note: string }[] = [
  { n: "A", name: "Now", sky: ["168 200 232", 0.85], mint: ["167 229 211", 0.6], note: "The AI Platform canvas pair: pale sky, pale mint." },
  { n: "B", name: "Same hues, full strength", sky: ["168 200 232", 1], mint: ["167 229 211", 1], note: "The same two colours with the strength turned all the way up." },
  { n: "C", name: "Clear ocean", sky: ["120 176 232", 0.8], mint: ["112 216 184", 0.7], note: "A step deeper: cornflower blue, sea green." },
  { n: "D", name: "Vivid", sky: ["80 150 240", 0.75], mint: ["70 208 160", 0.65], note: "Saturated: it reads as colour, not as a tint." },
  { n: "E", name: "Teal leaning", sky: ["100 160 210", 0.8], mint: ["80 200 170", 0.75], note: "Both closer to teal, so they blend into each other." },
  { n: "F", name: "Periwinkle + aqua", sky: ["140 164 244", 0.8], mint: ["96 224 208", 0.7], note: "A bluer, slightly purple blue with a cool aqua." },
  { n: "G", name: "Old Surflog pair", sky: ["59 133 235", 0.6], mint: ["42 197 90", 0.45], note: "The detergent-poster blue and green Surflog used in early October, toned down." },
  { n: "H", name: "Image 1: light", sky: ["143 208 231", 0.95], mint: ["78 207 185", 0.85], note: "Sky #8FD0E7 and mint #4ECFB9, sampled from the gradient image you sent." },
  { n: "I", name: "Image 1: teal and green", sky: ["88 169 173", 0.8], mint: ["8 115 96", 0.55], note: "The image's teal #58A9AD and deep green #087360: richer, darker." },
  { n: "J", name: "Image 1: deepest", sky: ["143 208 231", 0.9], mint: ["4 30 53", 0.4], note: "Sky with the image's navy #041E35 as the second orb. Heavy; text over it needs the cards." },
  { n: "K", name: "Image 2: royal blue + mint (live now)", sky: ["58 102 201", 0.7], mint: ["79 212 176", 0.85], note: "The second image: deep royal blue and fresh mint. Colours judged by eye (the picture could not be sampled)." },
  { n: "L", name: "Image 2: softer", sky: ["110 140 220", 0.7], mint: ["100 220 190", 0.8], note: "The same pair at the lighter periwinkle and seafoam edges of that image." },
];

const orb = (rgb: string, a: number) =>
  `radial-gradient(circle, rgb(${rgb} / ${a}) 0%, rgb(${rgb} / 0) 68%)`;

function Mock({ sky, mint }: { sky: [string, number]; mint: [string, number] }) {
  const orbBase: CSSProperties = { position: "absolute", borderRadius: 9999, filter: "blur(30px)" };
  return (
    <div className="relative h-[330px] overflow-hidden rounded-[var(--r-card)] bg-white shadow-soft">
      <span style={{ ...orbBase, right: -80, top: -56, width: 520, height: 520, background: orb(...sky) }} />
      <span style={{ ...orbBase, right: 220, top: 104, width: 300, height: 300, background: orb(...mint) }} />
      <div className="relative px-4 pt-3">
        <div className="glass-pill flex items-center justify-between rounded-full py-1.5 pr-1.5 pl-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/surflog-logo.png" alt="" className="block h-6 w-auto" />
          <span className="flex size-10 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-badge-foreground">A</span>
        </div>
        <div className="mt-4 grid grid-cols-[2fr_1fr] gap-3">
          <div className="surface-card h-[110px] rounded-[var(--r-card)] p-3 text-[12px] font-semibold text-muted-foreground">Goal for next session</div>
          <div className="surface-card h-[110px] rounded-[var(--r-card)] p-3 text-[12px] font-semibold text-muted-foreground">Days in the water</div>
        </div>
        <div className="surface-card mt-3 h-[70px] rounded-[var(--r-card)] p-3 text-[12px] font-semibold text-muted-foreground">What you&apos;ve surfed</div>
      </div>
    </div>
  );
}

export default function GlowOptionsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-[880px] px-4.5 py-8">
      <h1 className="text-2xl font-extrabold">Page glow colours</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Twelve blue + green pairs on the same shape. The live page glow sits behind this page too, so judge each mock
        inside its own box. Dev-only.
      </p>
      <div className="mt-6 flex flex-col gap-7">
        {OPTIONS.map((o) => (
          <section key={o.n}>
            <h2 className="text-[13px] font-bold">
              {o.n} · {o.name}{" "}
              <span className="font-mono font-normal text-muted-foreground">
                blue {o.sky[0]} @ {o.sky[1]} · green {o.mint[0]} @ {o.mint[1]}
              </span>
            </h2>
            <p className="mb-2 text-[12.5px] text-muted-foreground">{o.note}</p>
            <Mock sky={o.sky} mint={o.mint} />
          </section>
        ))}
      </div>
    </div>
  );
}
