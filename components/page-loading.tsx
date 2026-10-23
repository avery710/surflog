"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "cn";
import { LoadingHeader } from "@/components/page-skeleton";
import { useLang } from "@/lib/i18n";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * A loading animation instead of the grey skeleton (2026-10-21, candidates
 * for Avery to pick from at /dev/page-loading; nothing in the real routes uses
 * it yet). The blue header as it will look, then one small animation centred
 * in the free height, nudged a little above true centre. The body fades in
 * after 120 ms (`.page-loading-body`), like the skeleton, so a fast load never
 * flashes it. Colours come from the tokens (`text-primary`, `bg-primary/..`);
 * the motion lives in app/globals.css and is off under reduced motion, which
 * leaves a calm still frame.
 */
export type PageLoadingVariant = "swell" | "wordmark" | "cup" | "board" | "dots";

export const PAGE_LOADING_VARIANTS: { key: PageLoadingVariant; name: string; description: string }[] = [
  {
    key: "swell",
    name: "Swell",
    description: "Three translucent blue wave layers sliding at different speeds, edges faded out.",
  },
  {
    key: "wordmark",
    name: "Wordmark",
    description: "The Surflog wordmark filled by water that rises and falls inside the letters.",
  },
  {
    key: "cup",
    name: "Cup",
    description: "A round cup of water that fills, drains and sloshes, like the + button's hover.",
  },
  {
    key: "board",
    name: "Board",
    description: "A little surfboard riding the swell, lifting and tilting with the wave under it.",
  },
  {
    key: "dots",
    name: "Swell dots",
    description: "Three dots lifted in turn, as if a swell were passing under them.",
  },
];

export function PageLoading({ variant }: { variant: PageLoadingVariant }) {
  const { t } = useLang();
  return (
    <>
      <LoadingHeader />
      <div
        className={`${PAGE_COLUMN} flex min-w-0 flex-1 flex-col items-center justify-center pb-16`}
        role="status"
        aria-busy="true"
      >
        <span className="sr-only">{t("page.loading")}</span>
        <div aria-hidden className="page-loading-body">
          <LoadingAnimation variant={variant} />
        </div>
      </div>
    </>
  );
}

/** Just the animation (the dev page shows it in cards). */
export function LoadingAnimation({ variant }: { variant: PageLoadingVariant }) {
  switch (variant) {
    case "swell":
      return <Swell />;
    case "wordmark":
      return <Wordmark />;
    case "cup":
      return <Cup />;
    case "board":
      return <Board />;
    case "dots":
      return <Dots />;
  }
}

/** A wave across a 400-unit-wide viewBox: `period` units per wave (200 must
 *  be a whole number of them, so the loop is seamless at -50%), the crest
 *  `amp` above the mid line. Closed down to `h` for a filled body, or left
 *  open for a line. */
function wavePath(period: number, amp: number, h: number, closed: boolean) {
  const mid = amp + 1;
  const half = period / 2;
  const f = (n: number) => +n.toFixed(2);
  let d = `M0 ${mid} Q${f(period / 4)} ${mid - 2 * amp} ${f(half)} ${mid}`;
  for (let i = 2; i <= Math.round(400 / half); i++) d += ` T${f(i * half)} ${mid}`;
  return closed ? `${d} V${h} H0 Z` : d;
}

/** One scrolling wave: an SVG twice the box's width that slides left by the
 *  box's width per loop. `h` is its height in px (viewBox height matches, so
 *  only the horizontal axis stretches); `still` is the shift of the calm
 *  frame in percent. */
function Wave({
  period,
  amp,
  h,
  seconds,
  reverse,
  still = 0,
  fill,
  fade,
  line,
  lineOpacity = 1,
  className,
  style,
}: {
  period: number;
  amp: number;
  h: number;
  seconds: number;
  reverse?: boolean;
  still?: number;
  /** Closed body, at this opacity. */
  fill?: number;
  /** ...fading to nothing at the bottom instead of staying flat. */
  fade?: boolean;
  /** Open line stroke width. */
  line?: number;
  lineOpacity?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const gid = useId().replace(/\W/g, "");
  return (
    <svg
      viewBox={`0 0 400 ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("pl-scroll absolute left-0 block w-[200%] fill-current stroke-current", className)}
      style={
        {
          height: h,
          transform: `translateX(-${still}%)`,
          animationDirection: reverse ? "reverse" : undefined,
          "--d": `${seconds}s`,
          ...style,
        } as CSSProperties
      }
    >
      {fill !== undefined && !fade && (
        <path d={wavePath(period, amp, h, true)} fillOpacity={fill} stroke="none" />
      )}
      {fill !== undefined && fade && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity={fill} />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={wavePath(period, amp, h, true)} fill={`url(#${gid})`} stroke="none" />
        </>
      )}
      {line !== undefined && (
        <path
          d={wavePath(period, amp, h, false)}
          fill="none"
          strokeWidth={line}
          strokeOpacity={lineOpacity}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

/** Water that rises and falls inside its (clipping) parent: a wave crest
 *  riding on a body, optionally rocking. `lo`/`hi` are the surface's lowest and
 *  highest points as a share of the parent's height. */
function Water({
  lo,
  hi,
  seconds,
  wave,
  rock,
  wide,
}: {
  lo: string;
  hi: string;
  seconds: number;
  wave: { period: number; amp: number; h: number };
  rock?: boolean;
  /** Triple width, so a rocking surface never shows its end. */
  wide?: boolean;
}) {
  return (
    <div
      className="pl-rise absolute inset-0"
      style={{ "--pl-lo": lo, "--pl-hi": hi, "--d": `${seconds}s` } as CSSProperties}
    >
      <div
        className={cn("absolute top-0 h-[300%] origin-top text-primary", wide ? "-left-full w-[300%]" : "inset-x-0", rock && "pl-rock")}
      >
        {/* back layer: lighter, slower, the other way */}
        <div className="absolute inset-x-0" style={{ bottom: "calc(100% - 1px)" }}>
          <Wave {...wave} amp={wave.amp * 0.8} seconds={7} reverse still={30} fill={0.4} className="bottom-0 opacity-100" />
        </div>
        <div className="absolute inset-x-0" style={{ bottom: "calc(100% - 1px)" }}>
          <Wave {...wave} seconds={4.5} still={0} fill={1} className="bottom-0" />
        </div>
        <div className="absolute inset-x-0 top-0 bottom-0 bg-current" />
      </div>
    </div>
  );
}

/** 1. Three wave layers, back to front, each a gradient body that fades out
 *  downward; the box is masked to fade at both ends. */
function Swell() {
  return (
    <div className="pl-edges relative h-[76px] overflow-hidden w-[300px] max-w-[88vw] text-primary" aria-hidden>
      <Wave period={200} amp={9} h={60} seconds={9} still={12} fill={0.2} fade line={1.5} lineOpacity={0.25} className="bottom-0" />
      <Wave period={100} amp={7} h={46} seconds={6} reverse still={35} fill={0.32} fade line={1.5} lineOpacity={0.4} className="bottom-0" />
      <Wave period={200 / 3} amp={5} h={34} seconds={4} still={20} fill={0.55} fade line={2} lineOpacity={0.8} className="bottom-0" />
    </div>
  );
}

/** 2. The wordmark as a mask over a pale blue plate; water inside it. */
function Wordmark() {
  return (
    <div className="pl-wordmark relative aspect-[1200/228] w-[270px] max-w-[80vw] overflow-hidden bg-primary/15" aria-hidden>
      <Water lo="96%" hi="-14%" seconds={3.6} wave={{ period: 100, amp: 5, h: 14 }} />
    </div>
  );
}

/** 3. A cup (circle) of water. */
function Cup() {
  return (
    <div className="relative size-16 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/25 ring-inset" aria-hidden>
      <Water lo="88%" hi="18%" seconds={2.8} wave={{ period: 50, amp: 3, h: 9 }} rock wide />
    </div>
  );
}

/** 4. A surfboard bobbing and tilting with the wave line it rides. The wave
 *  box scrolls two periods in 4 s; the board's bob is tied to that (see the
 *  `.pl-bob-*` note in globals.css). */
function Board() {
  return (
    <div className="pl-edges relative h-[84px] overflow-hidden w-[300px] max-w-[88vw] text-primary" aria-hidden>
      <Wave period={200 / 3} amp={4} h={12} seconds={6} reverse still={20} line={2} className="top-[58px] opacity-25" />
      <Wave period={100} amp={5} h={40} seconds={4} still={0} fill={0.16} fade className="top-[40px]" />
      <Wave period={100} amp={5} h={14} seconds={4} still={0} line={2.5} className="top-[40px] opacity-60" />
      <div className="absolute top-[20px] left-1/2 -ml-[60px] w-[120px]">
        <div className="pl-bob-y">
          <div className="pl-bob-r">
            <svg viewBox="0 0 120 32" className="block w-full" fill="currentColor">
              <path d="M31 22 L22 31.5 Q31 30.5 40 23 Z" />
              <path d="M4 15 C4 19.5 20 23 60 23 C92 23 111 18 118.5 7 C106 14 90 13 60 13 C30 13 8 10.5 4 15 Z" />
              <path d="M14 15.4 C42 17.2 78 17 104 12" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 5. Three dots lifted in turn. */
function Dots() {
  return (
    <div className="flex h-12 items-end gap-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="pl-dot size-3.5 rounded-full bg-primary" style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}
