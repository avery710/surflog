import Link from "next/link";

/**
 * Index of every dev-only showcase page — see CLAUDE.md "Project agents"
 * (storybook). Not linked from the real app; 404s in production
 * (app/dev/layout.tsx), and proxy.ts only lets /dev through outside
 * production too.
 */
const PAGES = [
  {
    href: "/dev/landing",
    title: "Landing page",
    description:
      "components/landing/landing.tsx — the signed-out “/” page, viewable while signed in. Sign-in buttons do nothing here.",
  },
  {
    href: "/dev/session-card",
    title: "Session card",
    description:
      "components/entry-card.tsx — the session card: condition tiles, board/goal chips, notes, photos. Every media count (0-7, with and without conditions), every branch on missing data, both tide sources, wind extremes, en/zh-TW.",
  },
  {
    href: "/dev/tide-display",
    title: "Tide tile display ideas",
    description:
      "Six alternative displays for the session card's Tide tile (water staff, day band, countdown, hourly bars, tide table, tide stage) in six synthetic cases at 140 / 220 / 360 px. Suggestions only; the real card is unchanged.",
  },
  {
    href: "/dev/tide-span",
    title: "Tide curve: marking a time span",
    description:
      "Ten ways to mark the tide leg a session sat in (previous to next turning point) on the real Tide-tile curve, next to the session's own stretch: band, area, hatching, spotlight, fade, drop lines, carets, track, dimension line, dashed. The real chart is shown first, unchanged, next to the dev copy. Five synthetic cases at 140 / 220 / 360 px. Suggestions only.",
  },
  {
    href: "/dev/tide-blue",
    title: "Tide curve: the session's span in blue",
    description:
      "Ten ways to draw the session's own length in blue on the Tide-tile curve, after the \"Growth, plotted.\" poster: blue spotlight (now, on the real chart), route, bold time + caption, time pill, milestones, route track below, and four wave iterations (ripple, rolling waves, scallops, wave route). Six synthetic cases at 140 / 220 / 360 px, with and without a duration. Suggestions only.",
  },
  {
    href: "/dev/footer-options",
    title: "Footer options",
    description:
      "Four static footer layouts (icon row, centred stack, link columns, minimal line) at 375 and 1100 px with 2 and 5 social links. Suggestions only.",
  },
  {
    href: "/dev/dashboard",
    title: "Dashboard panel",
    description:
      "The teal-tinted panel above the session list (components/journal.tsx): GoalCard, activity calendar, the “What you've surfed” table, and the board rack together. Empty/typical/edge cases per section, en/zh-TW, fixed widths.",
  },
  {
    href: "/dev/add-button",
    title: "Add button hover",
    description:
      "Seven water-themed hover animations (ripples, floating, rising wave, a rising wave that follows the mouse with the “+” held still — now the real header button, splash, swell, gentle) for the header's white “+” button, on a replica of the blue header, with a force-hover switch and the focus ring.",
  },
  {
    href: "/dev/board-rack",
    title: "Board rack",
    description:
      "components/board-rack.tsx — the board list: default-badge toggle, ⋯ menu, specs/note/rocker fields, the three-breakpoint photo layout. Empty/one/two/many boards, missing-field branches, en/zh-TW, fixed widths.",
  },
  {
    href: "/dev/activity-preview",
    title: "Activity calendar",
    description:
      "components/activity-calendar.tsx with 1/2/3/4 months of synthetic session history, to compare sizing.",
  },
  {
    href: "/dev/signin-preview",
    title: "Sign-in card",
    description:
      "components/signin-card.tsx as a new visitor sees it, plus each OAuth error banner.",
  },
  {
    href: "/dev/share",
    title: "Share images and public page",
    description:
      "lib/share-image.tsx and components/share/public-share-view.tsx — the strip and column (transparent text, light/dark), card and link-preview images and the public /share/<token> page, for seven synthetic cases (long Chinese notes, no notes, missing period/temp/tide, no board, no conditions), en and zh-TW. Images come from /dev/share/image.",
  },
  {
    href: "/dev/mcp",
    title: "MCP tools — scope",
    description:
      "What an MCP client can and can't do through /api/mcp. The tool list (names, descriptions, parameters, read vs write token) is read from lib/mcp-tools.ts at render, so it can't drift; limits and the out-of-scope list are hand-written.",
  },
  {
    href: "/dev/color-preview",
    title: "Main colour",
    description: "Candidate accent colours side by side on mock header/card/tile pieces.",
  },
];

export default function DevIndexPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] px-4.5 py-8">
      <h1 className="font-sans text-2xl font-extrabold">Surflog dev showcase</h1>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Local-only component previews, synthetic data, no sign-in. 404s in production builds
        (<code>app/dev/layout.tsx</code>); <code>proxy.ts</code> only lets this path through
        when <code>NODE_ENV !== &quot;production&quot;</code>.
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {PAGES.map((p) => (
          <li key={p.href} className="rounded-[var(--r-card)] bg-card shadow-soft p-4">
            <Link href={p.href} className="text-[15px] font-bold text-primary underline underline-offset-2">
              {p.title}
            </Link>
            <p className="mt-1 text-[13.5px] text-muted-foreground">{p.description}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{p.href}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
