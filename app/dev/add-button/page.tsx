"use client";

import { useState } from "react";
import { AddButton, LogIcon } from "@/components/add-button";

/**
 * DEV-ONLY: hover-animation options for the header's white "+" button, each on
 * a replica of the blue header strip (same 40px button, 10px gap to the 36px
 * avatar, 8px of header above and below). Plain-English labels, like the other
 * dev pages. Nothing here touches the real header. 404s in production
 * (app/dev/layout.tsx).
 *
 * All effects are pure CSS: transform and opacity only (the one exception, the
 * border-radius morph in "Floating", is called out), `will-change` only while
 * active. They fire on :hover, :active (touch press) or when the page's
 * "Force hover" switch is on. Under prefers-reduced-motion they collapse to a
 * small scale change.
 */

const CSS = `
/* 1. Concentric ripples: three thin rings, staggered, like a drop in water */
.ab.v1 span.fx { border: 1.5px solid rgba(255,255,255,.85); }
.ab.v1:is(:hover, :active, [data-force="true"]) span.fx { animation: ab-ripple 1.5s cubic-bezier(.2,.6,.3,1) infinite; }
.ab.v1 span.fx:nth-of-type(2) { animation-delay: .5s !important; } .ab.v1 span.fx:nth-of-type(3) { animation-delay: 1s !important; }
@keyframes ab-ripple { 0% { transform: scale(1); opacity: .9 } 100% { transform: scale(1.75); opacity: 0 } }

/* 2. Floating: a translucent blob behind the circle morphs and drifts, a soft ring beneath */
.ab.v2 span.fx.blob { background: rgba(255,255,255,.35); opacity: 0; transition: opacity .3s, transform .4s; }
.ab.v2:is(:hover, :active, [data-force="true"]) span.fx.blob { opacity: 1; transform: scale(1.25); animation: ab-morph 3.2s ease-in-out infinite; }
.ab.v2 span.fx.soft { box-shadow: 0 0 0 6px rgba(255,255,255,.22); transition: opacity .3s, transform .5s; }
.ab.v2:is(:hover, :active, [data-force="true"]) span.fx.soft { opacity: 1; transform: scale(1.15); }
.ab.v2:is(:hover, :active, [data-force="true"]) { animation: ab-bob 2.6s ease-in-out infinite; }
@keyframes ab-morph { 0%,100% { border-radius: 50% 50% 46% 54% / 54% 46% 54% 46%; rotate: 0deg }
  50% { border-radius: 46% 54% 52% 48% / 48% 54% 46% 52%; rotate: 25deg } }

/* 3. Rising wave: a lighter-blue sine rises inside the circle, the plus bobs */
.ab.v3 { overflow: hidden; }
.ab.v3 .wave { position: absolute; left: 0; bottom: 0; width: 200%; height: 100%; transform: translateY(100%); transition: transform .7s cubic-bezier(.2,.7,.3,1); pointer-events: none; }
.ab.v3 .wave svg { width: 100%; height: 100%; display: block; animation: ab-wave 2.2s linear infinite; animation-play-state: paused; }
.ab.v3:is(:hover, :active, [data-force="true"]) .wave { transform: translateY(38%); }
.ab.v3:is(:hover, :active, [data-force="true"]) .wave svg { animation-play-state: running; }
.ab.v3:is(:hover, :active, [data-force="true"]) > svg { animation: ab-bob 1.8s ease-in-out infinite; }

/* 4. Splash: springy scale-up and eight droplets that fly out and fade */
.ab.v4:is(:hover, :active, [data-force="true"]) { transform: scale(1.1); }
.ab.v4 i { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 9999px; background: #fff; opacity: 0; pointer-events: none; }
.ab.v4:is(:hover, :active, [data-force="true"]) i { animation: ab-drop .9s cubic-bezier(.2,.7,.3,1) infinite; animation-delay: var(--d); }
@keyframes ab-drop { 0% { transform: rotate(var(--a)) translateY(-18px) scale(1); opacity: .95 } 100% { transform: rotate(var(--a)) translateY(-34px) scale(.2); opacity: 0 } }

/* 5. Swell: soft blurred rings breathing outward, slow and continuous */
.ab.v5 span.fx { inset: -12px; border-radius: 9999px; background: radial-gradient(circle, transparent 52%, rgba(255,255,255,.4) 62%, transparent 74%); }
.ab.v5:is(:hover, :active, [data-force="true"]) span.fx { animation: ab-swell 2.6s ease-out infinite; }
.ab.v5 span.fx:nth-of-type(2) { animation-delay: 1.3s !important; }
@keyframes ab-swell { 0% { transform: scale(.7); opacity: 0 } 25% { opacity: 1 } 100% { transform: scale(1.35); opacity: 0 } }

/* 6. Gentle: one thin ring plus one slow swell, a barely-there scale */
.ab.v6:is(:hover, :active, [data-force="true"]) { transform: scale(1.04); }
.ab.v6 span.fx.ring { border: 1.5px solid rgba(255,255,255,.8); }
.ab.v6 span.fx.sw { inset: -10px; background: radial-gradient(circle, transparent 54%, rgba(255,255,255,.3) 64%, transparent 76%); }
.ab.v6:is(:hover, :active, [data-force="true"]) span.fx.ring { animation: ab-ripple 2s cubic-bezier(.2,.6,.3,1) infinite; }
.ab.v6:is(:hover, :active, [data-force="true"]) span.fx.sw { animation: ab-swell 3s ease-out infinite; }



@media (prefers-reduced-motion: reduce) {
  .ab, .ab * { animation: none !important; transition: none !important; }
  .ab span.fx, .ab i { display: none; }
  .ab .wave, .ab .wf { display: none; }
  .ab:is(:hover, :active, [data-force="true"]) { transform: scale(1.06); filter: brightness(.95); }
}
`;

const DROPS = Array.from({ length: 8 }, (_, i) => ({ a: `${i * 45}deg`, d: `${(i % 4) * 0.1}s` }));

function Wave() {
  return (
    <span className="wave">
      <svg viewBox="0 0 80 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 8 Q10 0 20 8 T40 8 T60 8 T80 8 V40 H0 Z" fill="#cfd5ff" />
      </svg>
    </span>
  );
}


const VARIANTS = [
  {
    id: "v1",
    name: "1. Ripples",
    desc: "Three thin white rings expand and fade, staggered, like a drop falling in water. Needs ~17px of room around the circle.",
    touch: "On press the same rings play once per tap-and-hold.",
    body: () => (<><span className="fx" /><span className="fx" /><span className="fx" /></>),
  },
  {
    id: "v2",
    name: "2. Floating",
    desc: "A soft translucent blob behind the circle morphs and drifts, a faint ring beneath, the button bobs. Uses a border-radius morph (paint, not just transform).",
    touch: "Blob and ring appear while pressed.",
    body: () => (<><span className="fx blob" /><span className="fx soft" /></>),
  },
  {
    id: "v3",
    name: "3. Rising wave",
    desc: "A lighter-blue wave rises inside the circle and rolls sideways, the + bobs. Stays inside the circle: no extra room needed.",
    touch: "The wave rises while pressed and sinks on release.",
    body: () => <Wave />,
  },
  {
    id: "v3b",
    name: "3b. Rising wave, follows the mouse (the real header's button)",
    desc: "Adopted in the header 2026-10-16: circle-clipped water, pointer-following level and tilt, entry slosh and leave drain, but the glyph has no bob or offset and the circle no press scale. The \"+\" is drawn above the water (blue on pale blue stays legible).",
    touch: "Focus and touch press show the calm centred wave, glyph still.",
    body: () => null,
  },
  {
    id: "v4",
    name: "4. Splash",
    desc: "Springy scale-up and eight droplets that fly out and fade. ~15px of room.",
    touch: "Droplets splash on each press.",
    body: () => (<>{DROPS.map((d, i) => (<i key={i} style={{ ["--a" as string]: d.a, ["--d" as string]: d.d }} />))}</>),
  },
  {
    id: "v5",
    name: "5. Swell",
    desc: "Two soft blurred rings breathe outward slowly and continuously while hovered. ~17px of room.",
    touch: "Swell plays while pressed.",
    body: () => (<><span className="fx" /><span className="fx" /></>),
  },
  {
    id: "v6",
    name: "6. Gentle (1 + 5)",
    desc: "One thin ring plus one slow swell and a 4% scale. The quietest option, ~15px of room.",
    touch: "A single ring and swell on press.",
    body: () => (<><span className="fx sw" /><span className="fx ring" /></>),
  },
];

export default function AddButtonPreviewPage() {
  const [force, setForce] = useState<Record<string, boolean>>({});
  const [focus, setFocus] = useState(false);
  const allOn = VARIANTS.every((v) => force[v.id]);

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4.5 py-8">
      <style>{CSS}</style>
      <h1 className="font-sans text-2xl font-extrabold">Add button hover (dev only)</h1>
      <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
        Seven water-themed hover animations for the header &quot;+&quot; button, each on a replica of the blue header.
        Hover a button, or use &quot;Force hover&quot; to see it without a pointer. Nothing here changes the real
        header.
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={allOn}
            onChange={(e) => setForce(Object.fromEntries(VARIANTS.map((v) => [v.id, e.target.checked])))}
          />
          Force hover on all
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={focus} onChange={(e) => setFocus(e.target.checked)} />
          Show focus-visible ring
        </label>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {VARIANTS.map((v) => (
          <section key={v.id} className="min-w-0">
            {/* header replica: bg-primary, 8px above/below the 40px button, 10px gap to the avatar */}
            <div className="flex items-center justify-between rounded-[var(--r-card)] bg-primary px-4 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/surflog-logo.png" alt="" width={1200} height={228} className="block h-6 w-auto brightness-0 invert" />
              <div className="flex items-center gap-2.5">
                {v.id === "v3b" ? (
                  <AddButton label="Log a session" force={!!force[v.id]} focusRing={focus} />
                ) : (
                  <button
                    type="button"
                    className={`ab ${v.id}`}
                    data-force={force[v.id] ? "true" : undefined}
                    data-focus={focus ? "true" : undefined}
                    aria-label="Log a session"
                  >
                    {v.body()}
                    <LogIcon className="size-4" />
                  </button>
                )}
                <span className="size-9 rounded-full bg-[var(--badge)]" aria-hidden />
              </div>
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-sans text-[14px] font-bold">{v.name}</div>
                <p className="text-[12.5px] text-muted-foreground">{v.desc}</p>
                <p className="mt-0.5 text-[12px] text-[var(--faint)]">Touch: {v.touch}</p>
              </div>
              <label className="flex shrink-0 items-center gap-1 text-[12px]">
                <input
                  type="checkbox"
                  checked={!!force[v.id]}
                  onChange={(e) => setForce((f) => ({ ...f, [v.id]: e.target.checked }))}
                />
                Force hover
              </label>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8 max-w-[75ch] text-[13px] text-muted-foreground">
        <h2 className="font-sans text-[15px] font-bold text-foreground">Room and adopting one</h2>
        <p className="mt-1">
          The real header is the 40px button with 8px of bar above and below and a 10px gap to the avatar. Rings that
          reach ~15-17px poke ~8px out of the bar (the bar has no overflow clipping, and a sticky bar at z-30 paints
          over the page below) and ~5-7px into the avatar gap, so cap the largest scale near 1.7 and put the avatar
          above the rings (z-index) or leave them as is. Variant 3 needs no room at all.
        </p>
      </section>
    </div>
  );
}
