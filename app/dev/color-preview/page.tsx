import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

/**
 * DEV-ONLY: candidate main colours side by side on mock pieces of the UI.
 * Not linked anywhere; 404s in production. Delete with the rest of app/dev/.
 */

const OPTIONS = [
  { n: 0, name: "Current teal", main: "#0E7C86", soft: "#E0EFF0", contrast: "4.9:1" },
  { n: 1, name: "Ocean", main: "#1D6FB8", soft: "#E3EEF9", contrast: "5.2:1" },
  { n: 2, name: "Deep sea", main: "#1E4E8C", soft: "#E4EBF5", contrast: "8.3:1" },
  { n: 3, name: "Surf blue", main: "#2563EB", soft: "#E6EEFD", contrast: "5.2:1" },
  { n: 4, name: "Azure", main: "#0A6FA8", soft: "#E0EEF6", contrast: "5.5:1" },
  { n: 5, name: "Sky", main: "#3B8FD9", soft: "#E5F1FB", contrast: "3.4:1 (too low for text)" },
];

// A month of dots: s = surfed, p = past no-surf, f = future.
const DOTS = "pspppspsppppspppssppspf fffffff".replace(/ /g, "").split("");

export default function ColorPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto w-full max-w-[880px] px-4.5 py-8">
      <h1 className="font-sans text-2xl font-extrabold">Main colour preview (dev only)</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Same mock pieces in each colour. Contrast = white text on the main colour (4.5:1 needed).
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <section
            key={o.n}
            style={{ "--c": o.main, "--c-soft": o.soft } as CSSProperties}
            className="rounded-[var(--r-card)] border border-border bg-[var(--c-soft)] p-3"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-[var(--shadow-card)]">
              <span className="text-lg font-extrabold">Surflog</span>
              <span className="flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-[var(--c)] text-xl font-bold text-white">+</span>
                <span className="size-9 rounded-full bg-secondary" />
              </span>
            </div>

            {/* Card */}
            <div className="mt-3 rounded-[var(--r-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-bold">
                  {o.n}. {o.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{o.main}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">contrast {o.contrast}</div>

              {/* Buttons + pills */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--c)] px-4 py-1.5 text-sm font-bold text-white">
                  Save session
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--c-soft)] px-3 py-1 text-xs font-semibold text-[var(--c)]">
                  ✓ Default
                </span>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                  Set as default
                </span>
              </div>

              {/* Calendar dots */}
              <div className="mt-4 flex items-start gap-3">
                <span className="w-7 text-xs font-semibold">Sep</span>
                <div className="grid grid-cols-[repeat(14,10px)] gap-1.5">
                  {DOTS.map((d, i) => (
                    <span
                      key={i}
                      className={
                        "size-2.5 rounded-full " +
                        (d === "s"
                          ? "bg-[var(--c)]"
                          : d === "p"
                            ? "bg-[#dfe5e6]"
                            : "border border-[#c3cccd]")
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Condition tile */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[var(--r-tile)] bg-secondary px-3 py-2.5">
                  <div className="text-[12px] font-semibold text-[var(--faint)]">Wind</div>
                  <div className="font-mono text-[18px]">
                    4.2<span className="ml-0.5 text-[11px] text-muted-foreground">m/s</span>
                  </div>
                  <div className="text-[12px] font-bold text-[var(--c)]">← E <span className="font-medium text-muted-foreground">cross-shore</span></div>
                </div>
                <div className="rounded-[var(--r-tile)] bg-secondary px-3 py-2.5">
                  <div className="text-[12px] font-semibold text-[var(--faint)]">Tide</div>
                  <div className="text-[15px] font-semibold">Rising</div>
                  <svg viewBox="0 0 100 24" className="mt-1 h-5 w-full">
                    <path d="M0 18 C 20 18, 30 4, 50 4 S 80 20, 100 16" fill="none" stroke="var(--c)" strokeWidth="2" />
                    <circle cx="38" cy="7" r="3" fill="var(--c)" />
                  </svg>
                </div>
              </div>

              {/* Link + focus ring */}
              <div className="mt-3 flex items-center gap-3 text-sm">
                <span className="font-semibold text-[var(--c)] underline underline-offset-2">Edit goal</span>
                <span className="rounded-[10px] border border-border px-3 py-1 outline-2 outline-offset-1 outline-[var(--c)] [outline-style:solid]">
                  focused input
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
