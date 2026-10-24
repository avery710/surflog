"use client";

import { useState, type CSSProperties } from "react";
import { LogIcon } from "@/components/add-button";
import { LoadingHeader } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { PAGE_COLUMN } from "@/lib/layout";

/**
 * DEV-ONLY: try a main colour on the real header pill and a few real
 * controls, live. Pick a swatch, type a hex or use the colour picker; the
 * page rescopes --primary (and the tokens that mirror it in globals.css) on
 * the preview wrapper only, so nothing leaves this page. When you've chosen,
 * copy the snippet at the bottom into app/globals.css. Dev only
 * (app/dev/layout.tsx).
 */
const PRESETS: { group: string; items: { name: string; hex: string }[] }[] = [
  {
    group: "Bright and electric",
    items: [
      { name: "Current", hex: "#0018FF" },
      { name: "Signal", hex: "#0033FF" },
      { name: "Cobalt", hex: "#0047FF" },
      { name: "Azure", hex: "#0A5CFF" },
      { name: "Google blue", hex: "#1A73E8" },
      { name: "Cornflower", hex: "#2B6BFF" },
      { name: "Dodger", hex: "#0066FF" },
      { name: "Atlassian", hex: "#0052CC" },
    ],
  },
  {
    group: "Calmer and deeper",
    items: [
      { name: "Royal", hex: "#1F3FE0" },
      { name: "Bluebird", hex: "#2547C9" },
      { name: "Ocean", hex: "#0B63CE" },
      { name: "Tide", hex: "#0A4FB5" },
      { name: "Deep sea", hex: "#0A3FA8" },
      { name: "Midnight", hex: "#16299A" },
      { name: "Abyss", hex: "#10206E" },
      { name: "Navy slate", hex: "#1B3A6B" },
    ],
  },
  {
    group: "Toward violet or teal",
    items: [
      { name: "Indigo", hex: "#3B2EFF" },
      { name: "Iris", hex: "#4F46E5" },
      { name: "Periwinkle", hex: "#5B5BFF" },
      { name: "Ultramarine", hex: "#2A2FD6" },
      { name: "Pacific", hex: "#0070D6" },
      { name: "Lagoon", hex: "#0077B6" },
      { name: "Teal blue", hex: "#0A6C94" },
      { name: "Harbor", hex: "#00629B" },
    ],
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** WCAG contrast of white text on `hex`. */
function whiteContrast(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin(0) + 0.7152 * lin(1) + 0.0722 * lin(2);
  return 1.05 / (l + 0.05);
}

export default function ColorsDevPage() {
  const [hex, setHex] = useState("#0018FF");
  const [draft, setDraft] = useState("#0018FF");
  const [copied, setCopied] = useState(false);

  function apply(next: string) {
    setHex(next);
    setDraft(next);
  }

  const ratio = whiteContrast(hex);
  const lower = hex.toLowerCase();
  // Every token in globals.css that is the same blue as --primary.
  const scope = {
    "--primary": lower,
    "--primary-vivid": lower,
    "--accent-foreground": lower,
    "--ring": lower,
    "--chart-1": lower,
    "--sidebar-primary": lower,
    "--sidebar-accent-foreground": lower,
    "--sidebar-ring": lower,
  } as CSSProperties;
  const snippet = `--primary: ${lower};\n--primary-vivid: ${lower};\n--accent-foreground: ${lower};\n--ring: ${lower};\n--chart-1: ${lower};\n--sidebar-primary: ${lower};\n--sidebar-accent-foreground: ${lower};\n--sidebar-ring: ${lower};`;

  return (
    <div style={scope}>
      <div className="border-b bg-card">
        <div className={`${PAGE_COLUMN} flex flex-col gap-4 py-4`}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Pick a colour"
              value={lower}
              onChange={(e) => apply(e.target.value.toUpperCase())}
              className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
            />
            <input
              aria-label="Hex value"
              value={draft}
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                setDraft(v);
                if (HEX.test(v)) setHex(v.toUpperCase());
              }}
              className="h-9 w-28 rounded-md border border-input bg-background px-2.5 font-mono text-sm"
            />
            <span className="font-mono text-xs text-muted-foreground">
              white on this: {ratio.toFixed(1)}:1{" "}
              {ratio >= 4.5 ? "(passes 4.5:1)" : ratio >= 3 ? "(large text only)" : "(too low)"}
            </span>
            <Button variant="outline" size="sm" onClick={() => apply("#0018FF")}>
              Reset
            </Button>
          </div>
          {PRESETS.map((g) => (
            <div key={g.group}>
              <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{g.group}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => apply(p.hex)}
                    aria-label={`${p.name} ${p.hex}`}
                    aria-pressed={hex === p.hex}
                    className={`flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-[12px] ${hex === p.hex ? "border-foreground" : "border-border"}`}
                  >
                    <span className="size-5 rounded-full" style={{ background: p.hex }} />
                    {p.name}
                    <span className="font-mono text-[10.5px] text-muted-foreground">{p.hex}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The real pill header (components/page-skeleton.tsx, same classes as the journal's). */}
      <LoadingHeader />

      <div className={`${PAGE_COLUMN} flex flex-col gap-3 pt-4 pb-10`}>
        <div className="rounded-[var(--r-card)] bg-card p-4 shadow-soft">
          <div className="mb-3 text-[13px] font-semibold text-muted-foreground">Controls that read the colour</div>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Save session</Button>
            <Button variant="outline">Cancel</Button>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[13px] text-primary-foreground">
              Last 30 days
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[13px]">
              Eyes down the line <span className="font-mono text-primary">✓ 7</span>
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-primary text-white">
              <LogIcon className="size-4" />
            </span>
            <a href="#top" className="text-sm font-semibold text-primary underline underline-offset-2">
              A link
            </a>
          </div>
          <input
            placeholder="Click to see the focus border"
            className="mt-3 h-9 w-full max-w-xs rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:border-ring"
          />
        </div>

        <div className="rounded-[var(--r-card)] bg-card p-4 shadow-soft">
          <div className="mb-2 text-[13px] font-semibold text-muted-foreground">Days in the water</div>
          <div className="flex gap-1.5">
            {Array.from({ length: 21 }, (_, i) => (
              <span
                key={i}
                className={`size-3.5 rounded-full ${[2, 5, 6, 11, 15, 16, 19].includes(i) ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[var(--r-card)] bg-card p-4 shadow-soft">
          <div className="mb-2 text-[13px] font-semibold text-muted-foreground">Copy into app/globals.css</div>
          <pre className="overflow-x-auto rounded-md bg-secondary p-3 font-mono text-[12px]">{snippet}</pre>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(snippet).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Lines 141–142, 215, 219, 220, 228, 231 and 233 hold the same blue. The share images and landing stickers
            have the old blue baked in.
          </p>
        </div>
      </div>
    </div>
  );
}
