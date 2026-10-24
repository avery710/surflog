import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

/**
 * DEV-ONLY: the grey of chips, tiles and board cards, in seven versions. Each
 * sample is the same see-through white card with a board chip, a goal pill, two
 * tiles and a rack card; only --secondary / --muted (and an optional hairline)
 * change. Pick one, then the value goes into app/globals.css. 404s in production.
 */
const OPTIONS: { n: string; name: string; hex: string; line?: string; note: string }[] = [
  { n: "A", name: "Neutral", hex: "#f5f5f5", note: "Now. AI Platform canvas grey, no tint." },
  { n: "B", name: "Canvas soft + hairline", hex: "#fafafa", line: "#f0efed", note: "As on the Surflog x AI Platform canvas: very light, held by a 1px line." },
  { n: "C", name: "Light neutral", hex: "#efefef", note: "A step darker than A, still no tint." },
  { n: "D", name: "Original cool", hex: "#f2f5f5", note: "Surflog's grey before the redesign (slightly blue-green)." },
  { n: "E", name: "Soft ink tint", hex: "rgb(12 10 9 / 0.045)", note: "The ink colour at 4.5%: always a hair darker than what is behind it." },
  { n: "F", name: "Neutral + hairline", hex: "#f7f7f7", line: "#e9e9e9", note: "Between A and B, with a slightly darker line." },
  { n: "G", name: "Warm (AI Platform strong)", hex: "#f0efed", note: "The brownish one. For comparison only." },
];

function Sample({ hex, line }: { hex: string; line?: string }) {
  const fill = { background: hex, boxShadow: line ? `inset 0 0 0 1px ${line}` : undefined } as CSSProperties;
  return (
    <div className="surface-card rounded-[var(--r-card)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-3 py-1 text-[13px] font-medium" style={fill}>小白 7&apos;4&quot;</span>
        <span className="rounded-full px-3 py-1 text-[13px]" style={fill}>✓ Bottom turn</span>
        <span className="rounded-full px-3 py-1 text-[13px] text-muted-foreground" style={fill}># Glassy</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ["Swell", "1.1", "m"],
          ["Period", "9", "s"],
          ["Water", "26.8", "°C"],
        ].map(([l, v, u]) => (
          <div key={l} className="rounded-[var(--r-tile)] px-3 py-2" style={fill}>
            <div className="text-[11px] font-semibold text-muted-foreground">{l}</div>
            <div className="font-mono text-[18px]">
              {v}
              <span className="text-[10px] text-muted-foreground"> {u}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-[var(--r-tile)] px-3 py-2.5" style={fill}>
        <span className="size-9 rounded-sm bg-black/10" />
        <div>
          <div className="text-[14px] font-bold">Goofy Plank</div>
          <div className="font-mono text-[11px] text-muted-foreground">7&apos;0&quot; · 55 L · Low rocker</div>
        </div>
        <span className="ml-auto text-muted-foreground">···</span>
      </div>
    </div>
  );
}

export default function GreyOptionsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4.5 py-8">
      <h1 className="text-2xl font-extrabold">Grey of chips, tiles and cards</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Same card, seven greys, on the real page and the 50% white card. Dev-only.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        {OPTIONS.map((o) => (
          <section key={o.n}>
            <h2 className="mb-1.5 text-[13px] font-bold">
              {o.n} · {o.name} <span className="font-mono font-normal text-muted-foreground">{o.hex}{o.line ? ` + ${o.line}` : ""}</span>
            </h2>
            <p className="mb-2 text-[12.5px] text-muted-foreground">{o.note}</p>
            <Sample hex={o.hex} line={o.line} />
          </section>
        ))}
      </div>
    </div>
  );
}
