"use client";

import { useState } from "react";
import { BoardRack } from "@/components/board-rack";
import { LangSwitch } from "@/app/dev/lang-switch";
import { fakeBoard, logAction } from "@/app/dev/fixtures";
import type { Board } from "@/lib/types";

/**
 * components/board-rack.tsx (BoardRack) in every case its branches produce
 * — see its own 2026-09-30 comments (the three-breakpoint photo layout, the
 * default-badge `onlyBoard` logic, the ⋯ overflow menu). Synthetic boards
 * only, built from ../fixtures.ts. Not linked from the real app; 404s in
 * production (app/dev/layout.tsx).
 *
 * BoardRack does its own fetching for every action (add/edit/delete,
 * set/clear default) — there's no callback prop for any of it except
 * onSaved/onDeleted/onRackChanged, which only update local state after a
 * real request already succeeded. So every button here hits the real
 * /api/boards/* routes and will fail (401 outside a signed-in session) —
 * that's expected, not a bug in this page. onSaved/onDeleted/onRackChanged
 * themselves are just console.log here (see entry-card/dashboard for the
 * same pattern).
 */

const onSaved = logAction("board-rack/onSaved") as (b: Board) => void;
const onDeleted = logAction("board-rack/onDeleted") as (id: string) => void;
const onRackChanged = logAction("board-rack/onRackChanged") as (boards: Board[]) => void;

interface CaseDef {
  id: string;
  group: string;
  title: string;
  caption: string;
  boards: Board[];
}

// --- Overview --------------------------------------------------------

const oneBoard = fakeBoard({
  id: "dev-rack-one",
  brand: "Pyzel Ghost",
  lengthIn: 74,
  volumeL: 29.5,
  rocker: "medium",
  isFavorite: false, // deliberately NOT marked — see the case caption
});

const twoBoardA = fakeBoard({
  id: "dev-rack-two-a",
  brand: "Pyzel Ghost",
  lengthIn: 74,
  volumeL: 29.5,
  rocker: "medium",
  isFavorite: true,
});
const twoBoardB = fakeBoard({
  id: "dev-rack-two-b",
  brand: "Firewire Dominator",
  lengthIn: 70,
  volumeL: 32,
  rocker: "low",
  isFavorite: false,
});

const manyBoards: Board[] = [
  fakeBoard({
    id: "dev-rack-many-1",
    brand: "Pyzel Ghost",
    lengthIn: 74,
    volumeL: 29.5,
    rocker: "medium",
    isFavorite: true,
    note: "Daily driver, good in most conditions.",
  }),
  fakeBoard({ id: "dev-rack-many-2", brand: "Firewire Dominator", lengthIn: 70, volumeL: 32, rocker: "low" }),
  fakeBoard({
    id: "dev-rack-many-3",
    brand: "Channel Islands Neck Beard 2",
    lengthIn: 68,
    volumeL: 25,
    rocker: "high",
    note: "Small-day board, goes in anything under waist high.",
  }),
  fakeBoard({ id: "dev-rack-many-4", brand: "", lengthIn: 90, volumeL: null, rocker: null, note: "Borrowed longboard, no name on it." }),
  fakeBoard({ id: "dev-rack-many-5", brand: "JS Monsta Box", lengthIn: 71.5, volumeL: 27.8, rocker: "medium" }),
  fakeBoard({ id: "dev-rack-many-6", brand: "Album Twin", lengthIn: 65, volumeL: 24, rocker: "high" }),
  fakeBoard({ id: "dev-rack-many-7", brand: "Custom shape, no name", lengthIn: null, volumeL: 30, rocker: null }),
];

// --- Field edge cases --------------------------------------------------

const longNameEn = fakeBoard({
  id: "dev-rack-long-en",
  brand: "Firewire Very Long Custom Shaped Performance Shortboard Special Edition Model Name",
  lengthIn: 72,
  volumeL: 28,
  rocker: "medium",
});

const longNameZh = fakeBoard({
  id: "dev-rack-long-zh",
  brand: "超長的衝浪板名字測試一二三四五六七八九十",
  lengthIn: 72,
  volumeL: 28,
  rocker: "medium",
});

const specsOnlyNoBrand = fakeBoard({
  id: "dev-rack-no-brand",
  brand: "",
  lengthIn: 80, // 6'8"
  volumeL: 31,
  rocker: "low",
});

const lengthlessBoard = fakeBoard({
  id: "dev-rack-no-length",
  brand: "Custom shape, volume only",
  lengthIn: null,
  volumeL: 30,
  rocker: null,
});

const noSpecsBoard = fakeBoard({
  id: "dev-rack-no-specs",
  brand: "Mystery board",
  lengthIn: null,
  volumeL: null,
  rocker: null,
});

const longNoteEn = fakeBoard({
  id: "dev-rack-long-note-en",
  brand: "Pyzel Ghost",
  lengthIn: 74,
  volumeL: 29.5,
  rocker: "medium",
  note:
    "Picked this up secondhand two seasons ago — slightly yellowed rail but no dings. Goes best in chest-to-head " +
    "high waves with some push; feels sluggish in anything under waist high. Fin setup is FCS II, currently running " +
    "a medium/stiff thruster set. Ding repaired on the left rail near the tail in March, holding up fine since.",
});

const longNoteZh = fakeBoard({
  id: "dev-rack-long-note-zh",
  brand: "JS Monsta Box",
  lengthIn: 71.5,
  volumeL: 27.8,
  rocker: "high",
  note:
    "二手買的，板底有一些細微刮痕但不影響浮力。適合胸到頭高、有一點推力的浪，浪小的時候划水比較吃力。" +
    "舵是 FCS II，目前裝中等硬度的三舵。去年底補過板尾左側的一個小傷，之後都沒問題，下次想換一組更硬的舵試試。",
});

const rockerTrio: Board[] = [
  fakeBoard({ id: "dev-rack-rocker-low", brand: "Low rocker board", lengthIn: 78, volumeL: 34, rocker: "low" }),
  fakeBoard({ id: "dev-rack-rocker-medium", brand: "Medium rocker board", lengthIn: 74, volumeL: 29.5, rocker: "medium" }),
  fakeBoard({ id: "dev-rack-rocker-high", brand: "High rocker board", lengthIn: 68, volumeL: 25, rocker: "high" }),
];

const CASES: CaseDef[] = [
  {
    id: "empty",
    group: "Overview",
    title: "Empty rack",
    caption: "boards: [] — the “no boards yet” message (board.empty), Add board button still shown in the header.",
    boards: [],
  },
  {
    id: "one-board",
    group: "Overview",
    title: "One board, implicitly default",
    caption:
      "onlyBoard (boards.length === 1) is true. isDefault is false on the fixture, but defaultBoardId() still returns the lone board (a marked default wins, else a solo board counts as default) — so the badge renders teal “✓ Default”, but the toggle button is disabled (onlyBoard) with title board.onlyDefault, not b.id === defaultId ? clearDefault : undefined.",
    boards: [oneBoard],
  },
  {
    id: "two-boards",
    group: "Overview",
    title: "Two boards, one marked default",
    caption:
      "onlyBoard is false — both badges are live buttons: the default board shows teal “✓ Default” (title board.clearDefault), the other a plain “Set as default” pill (no title).",
    boards: [twoBoardA, twoBoardB],
  },
  {
    id: "many-boards",
    group: "Overview",
    title: "Many boards (7)",
    caption:
      "The sm:grid-cols-2 rack grid with enough items to wrap to several rows; includes a brand-less board (falls back to its formatted length as the name, {b.brand || name}) and one with no length (specs show volume only).",
    boards: manyBoards,
  },
  {
    id: "long-name-en",
    group: "Field edge cases",
    title: "Long English brand name",
    caption: "A long, space-separated brand — truncate on the name span still clips it to one line with an ellipsis; the Default badge and ⋯ menu never shrink.",
    boards: [longNameEn],
  },
  {
    id: "long-name-zh",
    group: "Field edge cases",
    title: "Long Chinese brand name (no spaces)",
    caption: "超長的衝浪板名字測試一二三四五六七八九十 — CJK truncation, no natural break points for the browser to wrap at.",
    boards: [longNameZh],
  },
  {
    id: "specs-only-no-brand",
    group: "Field edge cases",
    title: "No brand — name falls back to formatted length",
    caption: "brand: \"\" → boardLabel() returns just formatLength() (6'8\"); the name row shows that instead of a brand string.",
    boards: [specsOnlyNoBrand],
  },
  {
    id: "no-length",
    group: "Field edge cases",
    title: "No length — specs show volume only",
    caption: "lengthIn null, volumeL set, rocker null — the specs line's .filter(Boolean) drops the length and rocker pieces, joining just the volume.",
    boards: [lengthlessBoard],
  },
  {
    id: "no-specs",
    group: "Field edge cases",
    title: "No specs at all",
    caption: "lengthIn, volumeL and rocker all null — specs.length === 0, so the whole mono specs line is omitted (not rendered empty).",
    boards: [noSpecsBoard],
  },
  {
    id: "long-note-en",
    group: "Field edge cases",
    title: "Long English note",
    caption: "note well past two lines — line-clamp-2 truncates it, no “read more” affordance.",
    boards: [longNoteEn],
  },
  {
    id: "long-note-zh",
    group: "Field edge cases",
    title: "Long Chinese note",
    caption: "Same line-clamp-2 truncation with CJK text and no spaces to break on.",
    boards: [longNoteZh],
  },
  {
    id: "rockers",
    group: "Field edge cases",
    title: "Rocker: low / medium / high",
    caption: "board.rockerValue (“{r} rocker” / “弧度：{r}”) with each of the three ROCKERS values — zh-TW uses plain 低/中/高, not surf jargon.",
    boards: rockerTrio,
  },
  {
    id: "photo-caveat",
    group: "Field edge cases",
    title: "Board photo (not renderable here)",
    caption:
      "Deliberately kept photo-less (photoId: null): real photo tiles load from /api/blob/:id, which is owner-checked and would 401 for a synthetic id without weakening auth (not done, see CLAUDE.md “Hard rule”). Without a photo the sm+ image wrapper is `hidden`, and on phone it renders no box at all. BoardRack only takes photoId and builds the /api/blob/:id URL itself — there's no photoSrc-style override to point it at a local /dev asset instead; adding one would be a small, separate component change, left for the main session to decide on.",
    boards: [fakeBoard({ id: "dev-rack-photo", brand: "Pyzel Ghost", lengthIn: 74, volumeL: 29.5, rocker: "medium", photoId: null })],
  },
];

const WIDTHS = [
  { key: "375", label: "375px (phone)", px: 375 },
  { key: "768", label: "768px (tablet)", px: 768 },
  { key: "1200", label: "1200px (desktop)", px: 1200 },
  { key: "auto", label: "Auto (~880px, real app width)", px: null },
] as const;
type WidthKey = (typeof WIDTHS)[number]["key"];

function Frame({ px, children }: { px: number | null; children: React.ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg border border-dashed border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.02)_10px,rgba(0,0,0,0.02)_20px)] p-2">
      <div style={{ width: px ?? 880, maxWidth: px == null ? "100%" : undefined }}>{children}</div>
    </div>
  );
}

export default function BoardRackPreviewPage() {
  const [width, setWidth] = useState<WidthKey>("auto");
  const activeWidth = WIDTHS.find((w) => w.key === width) ?? WIDTHS[3];
  const twoBoardsCase = CASES.find((c) => c.id === "two-boards")!;
  const showGroupHeader = CASES.map((c, i) => i === 0 || CASES[i - 1].group !== c.group);

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4.5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-extrabold">Board rack (dev only)</h1>
          <p className="mt-1 max-w-[65ch] text-sm text-muted-foreground">
            components/board-rack.tsx (BoardRack) in every case its branches produce — synthetic boards from{" "}
            <code>app/dev/fixtures.ts</code>. Add/Edit/Delete/set-default inside it hit the real API and will fail
            here (no real session to save to) — that&apos;s expected.
          </p>
        </div>
        <LangSwitch />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <div className="rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4 py-3 text-[13px] text-foreground">
          <strong>Widths only emulate the component&apos;s own box.</strong> The rack grid&apos;s{" "}
          <code>sm:grid-cols-2</code> (2-up from sm) and the photo layout&apos;s own three breakpoints (phone / sm–lg
          / lg, see board-rack.tsx&apos;s 2026-09-30 comment) are real viewport media queries — they respond to the
          actual browser window&apos;s width, not this frame&apos;s. To see those breakpoints, resize the real
          browser window; a fixed-width frame below will still show whichever layout the browser window itself is
          currently at.
        </div>
        <div className="rounded-[var(--r-tile)] bg-secondary px-4 py-3 text-[13px] text-foreground">
          <strong>Nothing here persists.</strong> BoardRack fetches <code>/api/boards/*</code> directly for every
          action (add, edit, delete, set/clear default) — there&apos;s no callback prop to intercept those, only
          ones that fire after a real request already succeeded. Every button below will error (401) outside a
          signed-in session.
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-sans text-[15px] font-bold">Widths, side by side</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          The &ldquo;two boards&rdquo; case at all three reference widths (see the note above about real viewport
          breakpoints).
        </p>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {WIDTHS.filter((w) => w.px != null).map((w) => (
            <div key={w.key}>
              <div className="mb-1 font-mono text-xs text-muted-foreground">{w.label}</div>
              <Frame px={w.px}>
                <BoardRack
                  boards={twoBoardsCase.boards}
                  onSaved={onSaved}
                  onDeleted={onDeleted}
                  onRackChanged={onRackChanged}
                />
              </Frame>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-sans text-[15px] font-bold">All cases</h2>
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            {WIDTHS.map((w) => (
              <button
                key={w.key}
                type="button"
                onClick={() => setWidth(w.key)}
                className={
                  "rounded-full px-3 py-1 " +
                  (width === w.key ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-8">
          {CASES.map((c, i) => (
            <div key={c.id}>
              {showGroupHeader[i] && (
                <h3 className="mb-3 border-b border-border pb-1 font-sans text-[13px] font-bold tracking-wide text-muted-foreground uppercase">
                  {c.group}
                </h3>
              )}
              <div className="mb-1.5">
                <span className="font-sans text-[14px] font-bold">{c.title}</span>
                <p className="mt-0.5 max-w-[75ch] text-[12.5px] text-muted-foreground">{c.caption}</p>
              </div>
              <Frame px={activeWidth.px}>
                <BoardRack boards={c.boards} onSaved={onSaved} onDeleted={onDeleted} onRackChanged={onRackChanged} />
              </Frame>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
