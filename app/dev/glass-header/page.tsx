import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

/**
 * DEV-ONLY: the header's liquid glass in six versions, each over the same busy
 * strip (photo, big text, coloured blocks) so the blur, tint and rim show.
 * Pick one; its values then go into `.glass-pill` in app/globals.css.
 * 404s in production. F uses an SVG displacement filter (real refraction), which
 * only Chromium supports inside backdrop-filter.
 */
const VARIANTS: { n: string; name: string; note: string; style: CSSProperties }[] = [
  {
    n: "A",
    name: "Now: clear + frost",
    note: "No tint, blur 22, saturation 190%, thin white rim.",
    style: {
      background: "transparent",
      backdropFilter: "blur(22px) saturate(190%)",
      border: "1px solid rgb(255 255 255 / 0.75)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9), inset 0 -1px 0 rgb(12 10 9 / 0.04), 0 4px 18px rgb(12 10 9 / 0.08)",
    },
  },
  {
    n: "B",
    name: "Light blur",
    note: "Barely frosted: blur 8, no tint. Content still readable behind.",
    style: {
      background: "transparent",
      backdropFilter: "blur(8px) saturate(160%)",
      border: "1px solid rgb(255 255 255 / 0.7)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 4px 18px rgb(12 10 9 / 0.08)",
    },
  },
  {
    n: "C",
    name: "Frosted",
    note: "White tint 30%, blur 30. The most legible over photos.",
    style: {
      background: "rgb(255 255 255 / 0.3)",
      backdropFilter: "blur(30px) saturate(180%)",
      border: "1px solid rgb(255 255 255 / 0.8)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.95), 0 4px 18px rgb(12 10 9 / 0.1)",
    },
  },
  {
    n: "D",
    name: "Rim-lit",
    note: "Clear, but with a bright top edge and a faint bottom edge, like a lit glass pane.",
    style: {
      background: "linear-gradient(180deg, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0) 55%)",
      backdropFilter: "blur(14px) saturate(200%)",
      border: "1px solid rgb(255 255 255 / 0.55)",
      boxShadow:
        "inset 0 1.5px 0 rgb(255 255 255 / 1), inset 0 -1.5px 0 rgb(255 255 255 / 0.35), inset 0 0 18px rgb(255 255 255 / 0.25), 0 6px 22px rgb(12 10 9 / 0.1)",
    },
  },
  {
    n: "E",
    name: "Sky tint",
    note: "A hint of the glow's blue in the glass (sky at 18%), blur 20.",
    style: {
      background: "rgb(168 200 232 / 0.18)",
      backdropFilter: "blur(20px) saturate(190%)",
      border: "1px solid rgb(255 255 255 / 0.7)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9), 0 4px 18px rgb(12 10 9 / 0.08)",
    },
  },
  {
    n: "F",
    name: "Refraction (Chrome)",
    note: "Real liquid glass: the edges bend what is behind them. Chromium only; others see plain blur.",
    style: {
      background: "rgb(255 255 255 / 0.06)",
      backdropFilter: "url(#glass-refract) blur(4px) saturate(180%)",
      border: "1px solid rgb(255 255 255 / 0.6)",
      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.9), inset 0 0 14px rgb(255 255 255 / 0.2), 0 4px 18px rgb(12 10 9 / 0.1)",
    },
  },
];

function Pill({ style }: { style: CSSProperties }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-full py-1.5 pr-1.5 pl-5" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/surflog-logo.png" alt="Surflog" className="block h-6 w-auto" />
      <div className="flex items-center gap-2.5">
        <span className="ab" style={{ position: "relative" }}>
          <span className="text-[22px] leading-none">+</span>
        </span>
        <span className="flex size-10 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-badge-foreground">A</span>
      </div>
    </div>
  );
}

export default function GlassHeaderPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-[880px] px-4.5 py-8">
      <svg width="0" height="0" aria-hidden className="absolute">
        <filter id="glass-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="3" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <h1 className="text-2xl font-extrabold">Header glass</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Six versions of the pill over the same busy strip. Dev-only; the real header uses A.
      </p>
      <div className="mt-6 flex flex-col gap-8">
        {VARIANTS.map((v) => (
          <section key={v.n}>
            <h2 className="text-[13px] font-bold">
              {v.n} · {v.name}
            </h2>
            <p className="mb-2 text-[12.5px] text-muted-foreground">{v.note}</p>
            <div className="relative overflow-hidden rounded-[var(--r-card)] p-3">
              {/* a busy ground behind the pill: photo, hard text, coloured blocks */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/haydenshapes-futureflex.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div aria-hidden className="absolute inset-y-0 left-[38%] w-24 bg-[#0018ff]/70" />
              <div aria-hidden className="absolute inset-y-0 left-[62%] w-16 bg-[#2ac55a]/70" />
              <p aria-hidden className="absolute bottom-1 left-4 text-[34px] font-black leading-none tracking-tight text-white">
                Log it easy. Surf it better.
              </p>
              <div className="relative z-10 pb-9">
                <Pill style={v.style} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
