"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Live tuner. Every control sets a CSS variable on <html>; app/globals.css
 * (`.page-glow-*`, `.glass-pill`, `.surface-card`) reads them, so the glow behind
 * this very page is the real one. "Copy values" prints what to paste back.
 */
type S = {
  skyHex: string; skyA: number; skySize: number; skyRight: number; skyTop: number;
  mintHex: string; mintA: number; mintSize: number; mintRight: number; mintTop: number;
  blur: number; fade: number;
  shape: "orbs" | "arc" | "sweep" | "horizon" | "trio"; periHex: string; grain: number; contrast: number;
  glassBlur: number; glassSat: number; glassTint: number; glassRim: number;
  cardOpacity: number; greyOpacity: number;
  glowOn: boolean; fixed: boolean; glassOn: boolean; cardsOn: boolean;
};

const BASE: S = {
  skyHex: "#5096f0", skyA: 0.75, skySize: 520, skyRight: -80, skyTop: -56,
  mintHex: "#46d0a0", mintA: 0.65, mintSize: 300, mintRight: 220, mintTop: 104,
  blur: 30, fade: 68,
  shape: "orbs", periHex: "#578fcf", grain: 0, contrast: 100,
  glassBlur: 14, glassSat: 200, glassTint: 0.22, glassRim: 1,
  cardOpacity: 60, greyOpacity: 65,
  glowOn: true, fixed: true, glassOn: true, cardsOn: true,
};

const SHAPES: { key: S["shape"]; name: string }[] = [
  { key: "orbs", name: "Two orbs" },
  { key: "arc", name: "Arcs (like the poster)" },
  { key: "sweep", name: "Corner sweep" },
  { key: "horizon", name: "Horizon band" },
  { key: "trio", name: "Three orbs" },
];

const PRESETS: { name: string; set: Partial<S> }[] = [
  { name: "Image 3 poster", set: { skyHex: "#3a6cc4", skyA: 0.9, periHex: "#578fcf", mintHex: "#5ad3bb", mintA: 0.9 } },
  { name: "Image 3 + grain", set: { skyHex: "#3a6cc4", skyA: 0.9, periHex: "#578fcf", mintHex: "#5ad3bb", mintA: 0.9, grain: 0.6, contrast: 130 } },
  { name: "Image 3 arcs + grain", set: { shape: "arc", skyHex: "#3a6cc4", skyA: 0.9, periHex: "#578fcf", mintHex: "#5ad3bb", mintA: 0.9, grain: 0.7, contrast: 135, blur: 24 } },
  { name: "Canvas pale", set: { skyHex: "#a8c8e8", skyA: 0.85, mintHex: "#a7e5d3", mintA: 0.6 } },
  { name: "Image 1 light", set: { skyHex: "#8fd0e7", skyA: 0.95, mintHex: "#4ecfb9", mintA: 0.85 } },
  { name: "Image 1 teal", set: { skyHex: "#58a9ad", skyA: 0.8, mintHex: "#087360", mintA: 0.55 } },
  { name: "Image 2 royal + mint", set: { skyHex: "#3a66c9", skyA: 0.7, mintHex: "#4fd4b0", mintA: 0.85 } },
  { name: "Image 2 softer", set: { skyHex: "#6e8cdc", skyA: 0.7, mintHex: "#64dcbe", mintA: 0.8 } },
  { name: "Vivid", set: { skyHex: "#5096f0", skyA: 0.75, mintHex: "#46d0a0", mintA: 0.65 } },
  { name: "Heavy royal", set: { skyHex: "#2a52c0", skyA: 0.9, mintHex: "#3fd2a4", mintA: 0.95, skySize: 640, mintSize: 380, fade: 74 } },
];

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

function Slider(props: { label: string; value: number; min: number; max: number; step?: number; unit?: string; on: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px]">
      <span className="w-[92px] shrink-0 text-muted-foreground">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.on(Number(e.target.value))}
        className="min-w-0 flex-1 accent-[var(--primary)]"
      />
      <span className="w-[54px] shrink-0 text-right font-mono">{props.value}{props.unit ?? ""}</span>
    </label>
  );
}

function Toggle(props: { label: string; value: boolean; on: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.value}
      onClick={() => props.on(!props.value)}
      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${props.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
    >
      {props.label}: {props.value ? "on" : "off"}
    </button>
  );
}

export function GlowLab() {
  const [s, setS] = useState<S>(BASE);
  const [copied, setCopied] = useState(false);
  const up = (p: Partial<S>) => setS((x) => ({ ...x, ...p }));

  useEffect(() => {
    const r = document.documentElement.style;
    const set = (k: string, v: string) => r.setProperty(k, v);
    set("--glow-sky-rgb", rgb(s.skyHex)); set("--glow-sky-a", String(s.skyA));
    set("--glow-sky-size", `${s.skySize}px`); set("--glow-sky-right", `${s.skyRight}px`); set("--glow-sky-top", `${s.skyTop}px`);
    set("--glow-mint-rgb", rgb(s.mintHex)); set("--glow-mint-a", String(s.mintA));
    set("--glow-mint-size", `${s.mintSize}px`); set("--glow-mint-right", `${s.mintRight}px`); set("--glow-mint-top", `${s.mintTop}px`);
    set("--glow-blur", `${s.blur}px`); set("--glow-fade", `${s.fade}%`);
    set("--glow-peri-rgb", rgb(s.periHex));
    if (s.shape === "orbs") document.documentElement.removeAttribute("data-glow-shape");
    else document.documentElement.setAttribute("data-glow-shape", s.shape);
    set("--glow-bg", s.grain > 0 ? "#fff" : "transparent");
    set("--grain-a", String(s.grain)); set("--grain-contrast", String(s.grain > 0 ? s.contrast / 100 : 1));
    set("--glow-display", s.glowOn ? "block" : "none");
    set("--glow-position", s.fixed ? "fixed" : "absolute");
    set("--glass-blur", s.glassOn ? `${s.glassBlur}px` : "0px"); set("--glass-sat", `${s.glassSat}%`);
    set("--glass-tint", String(s.glassOn ? s.glassTint : 0)); set("--glass-rim", String(s.glassOn ? s.glassRim : 0));
    set("--card-opacity", `${s.cardsOn ? s.cardOpacity : 100}%`);
    set("--grey-opacity", `${s.cardsOn ? s.greyOpacity : 100}%`);
  }, [s]);
  // leave the page as it found it
  useEffect(
    () => () => {
      const r = document.documentElement.style;
      document.documentElement.removeAttribute("data-glow-shape");
      for (const k of [...r]) if (k.startsWith("--glow-") || k.startsWith("--grain-") || k.startsWith("--glass-") || k === "--card-opacity" || k === "--grey-opacity") r.removeProperty(k);
    },
    [],
  );

  const css = useMemo(
    () =>
      `.page-glow-sky  { right: ${s.skyRight}px; top: ${s.skyTop}px; width/height: ${s.skySize}px; color rgb(${rgb(s.skyHex)}) at ${s.skyA}, fade out by ${s.fade}% }
.page-glow-mint { right: ${s.mintRight}px; top: ${s.mintTop}px; width/height: ${s.mintSize}px; color rgb(${rgb(s.mintHex)}) at ${s.mintA}, fade out by ${s.fade}% }
shape: ${s.shape} · periwinkle ${s.periHex} · grain ${s.grain} · contrast ${s.contrast}%
glow blur ${s.blur}px · ${s.fixed ? "fixed to the screen" : "scrolls with the page"}
header glass: blur ${s.glassBlur}px, saturate ${s.glassSat}%, tint ${s.glassTint}, rim ${s.glassRim}
cards: ${s.cardOpacity}% white · grey chips and tiles: ${s.greyOpacity}%`,
    [s],
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4.5 pb-16 pt-5">
      <div className="glass-pill sticky top-3 z-20 flex items-center justify-between gap-4 rounded-full py-1.5 pr-1.5 pl-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/surflog-logo.png" alt="Surflog" className="block h-6 w-auto" />
        <span className="flex size-10 items-center justify-center rounded-full bg-badge text-[13px] font-bold text-badge-foreground">A</span>
      </div>

      <h1 className="mt-6 text-2xl font-extrabold">Glow lab</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The glow behind this page is the real one; every control changes it live. Dev-only, resets when you leave.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => up(p.set)} className="rounded-full bg-secondary px-3 py-1 text-[12px] font-semibold hover:brightness-95">
            {p.name}
          </button>
        ))}
        <button type="button" onClick={() => setS(BASE)} className="rounded-full border px-3 py-1 text-[12px] font-semibold">Reset</button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-muted-foreground">Shape</span>
        {SHAPES.map((sh) => (
          <button
            key={sh.key}
            type="button"
            aria-pressed={s.shape === sh.key}
            onClick={() => up({ shape: sh.key })}
            className={`rounded-full px-3 py-1 text-[12px] font-semibold ${s.shape === sh.key ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {sh.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Toggle label="Glow" value={s.glowOn} on={(v) => up({ glowOn: v })} />
        <Toggle label="Fixed to screen" value={s.fixed} on={(v) => up({ fixed: v })} />
        <Toggle label="Header glass" value={s.glassOn} on={(v) => up({ glassOn: v })} />
        <Toggle label="See-through cards" value={s.cardsOn} on={(v) => up({ cardsOn: v })} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section className="surface-card flex flex-col gap-2 rounded-[var(--r-card)] p-4">
          <h2 className="text-[13px] font-bold">Blue orb</h2>
          <label className="flex items-center gap-2 text-[12px]">
            <span className="w-[92px] shrink-0 text-muted-foreground">Colour</span>
            <input type="color" value={s.skyHex} onChange={(e) => up({ skyHex: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
            <span className="font-mono">{s.skyHex}</span>
          </label>
          <Slider label="Strength" value={s.skyA} min={0} max={1} step={0.05} on={(v) => up({ skyA: v })} />
          <Slider label="Size" value={s.skySize} min={200} max={900} step={10} unit="px" on={(v) => up({ skySize: v })} />
          <Slider label="From right" value={s.skyRight} min={-400} max={600} step={10} unit="px" on={(v) => up({ skyRight: v })} />
          <Slider label="From top" value={s.skyTop} min={-400} max={400} step={10} unit="px" on={(v) => up({ skyTop: v })} />
        </section>
        <section className="surface-card flex flex-col gap-2 rounded-[var(--r-card)] p-4">
          <h2 className="text-[13px] font-bold">Green orb</h2>
          <label className="flex items-center gap-2 text-[12px]">
            <span className="w-[92px] shrink-0 text-muted-foreground">Colour</span>
            <input type="color" value={s.mintHex} onChange={(e) => up({ mintHex: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
            <span className="font-mono">{s.mintHex}</span>
          </label>
          <Slider label="Strength" value={s.mintA} min={0} max={1} step={0.05} on={(v) => up({ mintA: v })} />
          <Slider label="Size" value={s.mintSize} min={150} max={900} step={10} unit="px" on={(v) => up({ mintSize: v })} />
          <Slider label="From right" value={s.mintRight} min={-400} max={900} step={10} unit="px" on={(v) => up({ mintRight: v })} />
          <Slider label="From top" value={s.mintTop} min={-300} max={500} step={10} unit="px" on={(v) => up({ mintTop: v })} />
        </section>
        <section className="surface-card flex flex-col gap-2 rounded-[var(--r-card)] p-4">
          <h2 className="text-[13px] font-bold">Both orbs, header, cards</h2>
          <label className="flex items-center gap-2 text-[12px]">
            <span className="w-[92px] shrink-0 text-muted-foreground">Mid blue</span>
            <input type="color" value={s.periHex} onChange={(e) => up({ periHex: e.target.value })} className="h-7 w-12 cursor-pointer rounded border" />
            <span className="font-mono">{s.periHex}</span>
          </label>
          <Slider label="Grain" value={s.grain} min={0} max={1} step={0.05} on={(v) => up({ grain: v })} />
          <Slider label="Grain contrast" value={s.contrast} min={100} max={300} step={10} unit="%" on={(v) => up({ contrast: v })} />
          <Slider label="Orb blur" value={s.blur} min={0} max={80} unit="px" on={(v) => up({ blur: v })} />
          <Slider label="Fades out at" value={s.fade} min={30} max={100} unit="%" on={(v) => up({ fade: v })} />
          <Slider label="Glass blur" value={s.glassBlur} min={0} max={40} unit="px" on={(v) => up({ glassBlur: v })} />
          <Slider label="Glass colour" value={s.glassSat} min={100} max={300} step={10} unit="%" on={(v) => up({ glassSat: v })} />
          <Slider label="Glass tint" value={s.glassTint} min={0} max={0.6} step={0.02} on={(v) => up({ glassTint: v })} />
          <Slider label="Glass rim" value={s.glassRim} min={0} max={1} step={0.05} on={(v) => up({ glassRim: v })} />
          <Slider label="Card white" value={s.cardOpacity} min={0} max={100} step={5} unit="%" on={(v) => up({ cardOpacity: v })} />
          <Slider label="Grey chips" value={s.greyOpacity} min={0} max={100} step={5} unit="%" on={(v) => up({ greyOpacity: v })} />
        </section>
      </div>

      <section className="mt-5">
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-[13px] font-bold">Values</h2>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(css).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
            className="rounded-full bg-secondary px-3 py-1 text-[12px] font-semibold"
          >
            {copied ? "Copied" : "Copy values"}
          </button>
        </div>
        <pre className="surface-card overflow-x-auto rounded-[var(--r-card)] p-3 font-mono text-[11.5px] leading-5">{css}</pre>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="surface-card rounded-[var(--r-card)] p-4">
          <div className="text-[12px] font-semibold text-muted-foreground">Goal for next session</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-[13px]">視線盯著浪壁 ✓ 4</span>
            <span className="rounded-full bg-secondary px-3 py-1 text-[13px]">Look where you want to go ✓ 3</span>
          </div>
        </div>
        <div className="surface-card rounded-[var(--r-card)] p-4">
          <div className="text-[12px] font-semibold text-muted-foreground">Swell · Period · Wind</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[["1.1", "m"], ["9", "s"], ["2.4", "m/s"]].map(([v, u]) => (
              <div key={u} className="rounded-[var(--r-tile)] bg-secondary px-3 py-2 font-mono text-[18px]">
                {v}<span className="text-[10px] text-muted-foreground"> {u}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="h-[900px]" aria-hidden />
    </div>
  );
}
