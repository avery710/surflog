import type { ReactNode } from "react";
import { AtSign, Mail } from "lucide-react";

/**
 * Footer layout options for when social links arrive (suggestions only; the
 * real footer is components/site-footer.tsx and is hidden on this route).
 * Static synthetic markup: no t(), no imports of the real footer. Each option
 * is drawn at a 375px phone frame and a 1100px desktop frame with a `wide`
 * prop (not sm: classes, which follow the window, not the frame), once with 2
 * links (mail + Instagram) and once with 5 (+ Threads, YouTube, Facebook).
 *
 * lucide-react 1.x ships NO brand icons (instagram/facebook/youtube/twitter
 * were removed), so the brand glyphs below are rough stand-ins; the real ones
 * should be Simple Icons paths (CC0) inlined as <svg fill="currentColor">.
 */

const stroke = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "size-4 shrink-0",
};
const Instagram = () => (
  <svg {...stroke}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" /></svg>
);
const Youtube = () => (
  <svg {...stroke}><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3z" /></svg>
);
const Facebook = () => (
  <svg {...stroke}><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" /></svg>
);

type Item = { key: string; label: string; href: string; icon: ReactNode; handle: string };
const ALL: Item[] = [
  { key: "mail", label: "Email support: support@surflog.tw", href: "mailto:support@surflog.tw", icon: <Mail className="size-4" aria-hidden />, handle: "support@surflog.tw" },
  { key: "ig", label: "Surflog on Instagram", href: "#", icon: <Instagram />, handle: "Instagram" },
  { key: "th", label: "Surflog on Threads", href: "#", icon: <AtSign className="size-4" aria-hidden />, handle: "Threads" },
  { key: "yt", label: "Surflog on YouTube", href: "#", icon: <Youtube />, handle: "YouTube" },
  { key: "fb", label: "Surflog on Facebook", href: "#", icon: <Facebook />, handle: "Facebook" },
];
const COUNTS = [2, 5] as const;

/** 32px circle drawn, 44px hit area via an invisible ::before (touch rule). */
function Circle({ item, ghost }: { item: Item; ghost?: boolean }) {
  return (
    <a
      href={item.href}
      aria-label={item.label}
      className={`relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-white/15 motion-reduce:transition-none ${ghost ? "" : "border-[1.5px] border-white/40 hover:border-white/20"}`}
    >
      {item.icon}
    </a>
  );
}
function Logo({ h = "h-5" }: { h?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/surflog-logo.png" alt="Surflog" width={1200} height={228} className={`block ${h} w-auto brightness-0 invert`} />
  );
}
const Copy = ({ className = "" }: { className?: string }) => (
  <p className={`text-[12.5px] leading-4 text-white/70 ${className}`}>© 2026 Surflog</p>
);

/* A: icons right, wrapping. */
function A({ items }: { items: Item[] }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col items-start gap-2"><Logo /><Copy /></div>
      <nav aria-label="Contact and social" className="flex flex-wrap justify-end gap-2 self-start">
        {items.map((i) => <Circle key={i.key} item={i} />)}
      </nav>
    </div>
  );
}
/* B: centred stack. */
function B({ items }: { items: Item[] }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Logo />
      <nav aria-label="Contact and social" className="flex flex-wrap justify-center gap-3">
        {items.map((i) => <Circle key={i.key} item={i} />)}
      </nav>
      <Copy />
    </div>
  );
}
/* C: link columns. */
function C({ items, wide }: { items: Item[]; wide: boolean }) {
  const social = items.filter((i) => i.key !== "mail");
  const link = "inline-flex min-h-8 items-center gap-2 py-1.5 text-sm font-medium text-white hover:text-white/70 transition-colors";
  return (
    <div className={`grid gap-x-8 gap-y-6 ${wide ? "grid-cols-[1.4fr_1fr_1fr_1fr]" : "grid-cols-2"}`}>
      <div className={`flex flex-col items-start gap-2 ${wide ? "" : "col-span-2"}`}><Logo /><Copy /></div>
      <nav aria-label="Product">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/70">Product</h2>
        <ul>{["Spots", "AI apps", "Boards"].map((l) => <li key={l}><a href="#" className={link}>{l}</a></li>)}</ul>
      </nav>
      <nav aria-label="Follow us">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/70">Follow us</h2>
        <ul>{social.map((i) => <li key={i.key}><a href={i.href} aria-label={i.label} className={link}>{i.icon}{i.handle}</a></li>)}</ul>
      </nav>
      <nav aria-label="Contact">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/70">Contact</h2>
        <ul><li><a href="mailto:support@surflog.tw" className={link}><Mail className="size-4" aria-hidden />Email us</a></li></ul>
      </nav>
    </div>
  );
}
/* D: minimal one line, ghost icons, no wordmark. */
function D({ items }: { items: Item[] }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Copy className="text-[13px]" />
      <nav aria-label="Contact and social" className="-mr-1.5 flex flex-wrap justify-end gap-1">
        {items.map((i) => <Circle key={i.key} item={i} ghost />)}
      </nav>
    </div>
  );
}

const OPTIONS: { id: string; title: string; blurb: string; render: (items: Item[], wide: boolean) => ReactNode }[] = [
  { id: "A", title: "A. Icon row on the right (today's layout, grown)", blurb: "Wordmark + copyright left, circles right in a wrapping row. Closest to what ships; wraps right-aligned past ~7 icons on a phone.", render: (i) => <A items={i} /> },
  { id: "B", title: "B. Centred stack", blurb: "Wordmark, centred icon row, copyright. Reads as a signature block, grows gracefully (wraps centred), best for a phone, a bit marketing-like on desktop.", render: (i) => <B items={i} /> },
  { id: "C", title: "C. Link columns (Product / Follow us / Contact)", blurb: "Labelled text links with small icons. Scales to any number of networks and to Privacy/Terms later; heaviest, ~2x the height.", render: (i, w) => <C items={i} wide={w} /> },
  { id: "D", title: "D. Minimal one line", blurb: "Copyright left, borderless icons right, no wordmark (the header already has it). Shortest banner (~56px); a 5-icon row on a phone eats the copyright's width, so it relies on wrapping.", render: (i) => <D items={i} /> },
];

function Frame({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div style={{ width }} className="bg-primary py-6 text-white">
        <div className="mx-auto px-3.5" style={{ maxWidth: width === 375 ? undefined : 1000 }}>{children}</div>
      </div>
    </div>
  );
}

export default function FooterOptionsPage() {
  return (
    <main className="mx-auto max-w-[1160px] px-4 py-10">
      <h1 className="text-2xl font-bold">Footer options</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Static mocks (the real footer is hidden here). Each option at 375px and 1100px, with 2 links (mail + Instagram) and 5 (+ Threads, YouTube, Facebook). Brand icons are stand-ins: lucide-react 1.x removed them.
      </p>
      <h2 className="mt-6 text-sm font-semibold">Accessibility</h2>
      <ul className="mt-1 max-w-2xl list-disc pl-5 text-sm text-muted-foreground">
        <li>Icon-only links keep an aria-label naming the destination (&ldquo;Surflog on Instagram&rdquo;), via t() in the real build; the group sits in a nav with its own label.</li>
        <li>Circles are 32px drawn; an invisible ::before adds 6px each side so the tap target is 44px (adjacent targets touch at 8px gaps, no overlap issue).</li>
        <li>White on #0018FF is 8.16:1; the 70% white copyright and column headings are about 4.6:1 (fine at 12px+ only just; do not go lower).</li>
        <li>No hover movement; focus rings are off globally (Avery), so hover/focus parity relies on the same fill change.</li>
      </ul>
      {OPTIONS.map((o) => (
        <section key={o.id} className="mt-10">
          <h2 className="text-lg font-semibold">{o.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{o.blurb}</p>
          {COUNTS.map((n) => (
            <div key={n} className="mt-4">
              <p className="mb-1 text-xs text-muted-foreground">{n} links</p>
              <div className="flex flex-wrap items-start gap-4">
                <Frame width={375}>{o.render(ALL.slice(0, n), false)}</Frame>
                <Frame width={1100}>{o.render(ALL.slice(0, n), true)}</Frame>
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
