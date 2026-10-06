"use client";

/**
 * "Goal for next session": a short bulleted list of technique points per
 * owner, stored as one `goals.text` column — points are newline-separated
 * lines in that single string, not a new table (see CLAUDE.md "Goal for
 * next session"). The card sits above the journal and is edited inline
 * (same click-to-edit / blur-to-save shape as the spot descriptions in
 * patterns-table.tsx, extended to a row per point). A session records only
 * the points ticked as achieved on it, by their wording (lib/goal.ts), so
 * the card shows, per point, in how many sessions it was ticked
 * (`achievedCounts()`); editing, adding or removing one point doesn't
 * touch the others.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Plus, X } from "lucide-react";
import { cn } from "cn";
import { CALENDAR_CARD_HEIGHT_PX } from "@/components/activity-calendar";
import { achievedCounts, goalPoints, joinGoalPoints, MAX_GOAL, type GoalRename } from "@/lib/goal";
import { useLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/** Shared type style for a goal point's text — the display bullet list and
 *  the edit-mode inputs both use this, so toggling into/out of edit mode
 *  doesn't change the point text's size, weight, line-height or tracking
 *  (2026-10-01, on request: the inputs used to be a plain 16px). Below
 *  16px, so focusing one of these inputs zooms the viewport on iOS
 *  Safari — accepted here, since matching the display text mattered more
 *  than avoiding that; not worked around in this change. */
const POINT_TEXT_CLASS = "text-[14.5px] font-bold leading-snug tracking-[-0.01em]";

/** One point while editing. `id` is only a stable React/dnd-kit key for
 *  this edit (rows used to be keyed by index, which can't survive a
 *  reorder). `origin` is the row's text when editing began (null = added
 *  this edit), so a changed row can be sent as a rename for past sessions
 *  — it travels with the row when the row is dragged. */
type PointRow = { id: string; text: string; origin: string | null };

/** The "add a point" box is a row in the same list (always exactly one
 *  while editing), so it can be dragged into place like any other and a
 *  new point lands where the box sits, not always at the end. Left empty
 *  it simply drops out on save (joinGoalPoints skips blank lines). */
const DRAFT_ID = "draft";

/** The list is a single column, so a dragged row only ever moves up/down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function GoalCard({
  goal,
  sessions,
  onSave,
}: {
  goal: string | null;
  sessions: Session[];
  /** Resolves true if saved, so the card knows whether to leave edit mode. */
  onSave: (text: string, renames: GoalRename[]) => Promise<boolean>;
}) {
  const { t } = useLang();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<PointRow[]>([]);
  const [saving, setSaving] = useState(false);
  const cancelled = useRef(false);
  const nextRowId = useRef(0);
  const points = rows.map((r) => r.text);

  // Same sensors as the board rack: a few px of movement before a press on
  // the handle becomes a drag, plus keyboard (Space, arrows, Space).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const newPointRef = useRef<HTMLInputElement>(null);

  // The scrollable points list (display mode only — see the height-cap
  // comment on the card wrapper below) and its bottom fade hint. Managed by
  // direct DOM reads/writes (no React state), same convention as
  // activity-calendar.tsx's updateArrowState — this file avoids
  // setState-in-effect, see CLAUDE.md "Conventions".
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  // In how many sessions each point has been ticked as achieved, matched
  // by the point's own wording — see achievedCounts().
  const counts = achievedCounts(goalPoints(goal), sessions);

  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    const fade = fadeRef.current;
    if (!el || !fade) return;
    const overflowing = el.scrollHeight > el.clientHeight + 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    fade.style.opacity = overflowing && !atBottom ? "1" : "0";
    // tabIndex/aria-label toggle with overflow too, so the list is only a
    // keyboard scroll stop (and only announces itself as scrollable) when
    // there's actually something to scroll to.
    if (overflowing) {
      el.tabIndex = 0;
      el.setAttribute("aria-label", t("goal.scrollHint"));
    } else {
      el.removeAttribute("tabindex");
      el.removeAttribute("aria-label");
    }
  }, [t]);

  // Re-check after every render that could change the list's content height
  // (new/removed points, counts filling in, language switch re-wrapping
  // text) — a plain effect with no deps array, like activity-preview's own
  // per-render DOM sync, so nothing has to be exhaustively listed and nothing
  // sets React state here.
  useLayoutEffect(() => {
    updateFade();
  });

  // Also re-check on the element's own size changes — covers the `sm`
  // breakpoint turning the height cap on/off, and the window resizing,
  // neither of which re-renders this component by itself. Re-subscribes
  // whenever `editing` flips, since the scrollable node only exists in
  // display mode (unmounted while editing).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateFade());
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateFade, editing]);

  function startEdit() {
    cancelled.current = false;
    setRows([
      ...goalPoints(goal).map((text) => ({ id: `p${nextRowId.current++}`, text, origin: text })),
      { id: DRAFT_ID, text: "", origin: null },
    ]);
    setEditing(true);
  }

  // The + button: what's typed in the "add a point" box becomes a point of
  // its own right where the box is, and the box (same row, so it keeps
  // focus) empties just below it for the next one.
  function addPoint() {
    const id = `p${nextRowId.current++}`;
    setRows((prev) =>
      prev.flatMap((r) => {
        if (r.id !== DRAFT_ID) return [r];
        const text = r.text.trim();
        return text ? [{ id, text, origin: null }, { ...r, text: "" }] : [r];
      })
    );
  }

  function removePoint(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    newPointRef.current?.focus();
  }

  function updatePoint(id: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, text: value } : r)));
  }

  // Reordering is staged like every other edit here: it only reaches the
  // server when focus leaves the block (commit()), and Escape discards it.
  // Past sessions are unaffected — their ticks are stored by wording, not
  // position (achievedCounts()).
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setRows((prev) => {
      const from = prev.findIndex((r) => r.id === active.id);
      const to = prev.findIndex((r) => r.id === over.id);
      return from < 0 || to < 0 ? prev : arrayMove(prev, from, to);
    });
  }

  function cancelEdit() {
    cancelled.current = true;
    setEditing(false);
  }

  async function commit() {
    if (cancelled.current || saving) return;
    // Anything still sitting in the "add a point" box counts too (it's one
    // of the rows), so tabbing/clicking away doesn't silently drop it.
    const next = joinGoalPoints(points);
    if (next === (goal ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const renames = rows.flatMap(({ text, origin }) =>
      origin != null && text.trim() && text.trim() !== origin ? [{ from: origin, to: text.trim() }] : []
    );
    const ok = await onSave(next, renames);
    setSaving(false);
    if (ok) setEditing(false);
  }

  const shownPoints = goalPoints(goal);
  const total = joinGoalPoints(points).length;

  return (
    // No mt here — this card sits inside journal.tsx's shared dashboard
    // panel now, which spaces its sections itself (gap-4).
    //
    // Height match with the activity calendar (2026-10-01, on request —
    // the calendar is now a fixed 4-week window, so it has a constant
    // height Avery wanted this card to line up with): on `sm+`, in display
    // mode only, the card's height is pinned to the calendar's own
    // (CALENDAR_CARD_HEIGHT_PX, exported from activity-calendar.tsx so
    // this doesn't hand-duplicate its geometry — see that file's own
    // comment for the arithmetic) via a CSS custom property, and the
    // points list becomes the part that scrolls past that height, with a
    // bottom fade hint when it does. Below `sm`, and whenever editing,
    // there's no cap — editing always shows every input row in full, and
    // below `sm` the two cards stack full-width anyway. The calendar
    // itself never stretches to match this card either way (see its own
    // sm:self-start) — only this card adapts to the pairing.
    <section>
      <div
        className={cn(
          "flex items-stretch gap-3 rounded-[var(--r-card)] border border-card-border bg-card px-5 py-3.5",
          !editing && "sm:h-[var(--goal-card-h)]"
        )}
        style={{ "--goal-card-h": `${CALENDAR_CARD_HEIGHT_PX}px` } as React.CSSProperties}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          {/* No horizontal padding here (unlike the px-2 used by the body
              rows below, for their own hover/input backgrounds) — the card's
              own px-5 already matches the 20px left edge every other
              dashboard-panel title sits at (patterns-table.tsx's p-2+px-3,
              board-rack.tsx's p-2+pl-3); the old px-2 pushed this one 8px
              further in than the others. */}
          <h2 className="shrink-0 pb-0.5 font-sans text-[13px] font-bold text-muted-foreground">
            {t("goal.title")}
          </h2>
          {/* Distinct keys on the two branches so React remounts instead of
              reusing nodes across them: unkeyed, the display branch's fade
              <div> (whose inline opacity:0 updateFade() sets directly, out of
              React's sight) got reused as the "add a point" row, leaving that
              row invisible in edit mode. */}
          {editing ? (
            <div
              key="edit"
              className="flex flex-col gap-1.5 px-2 py-1"
              // Commit when focus leaves the whole editing block, not on
              // every blur between its own rows (tabbing/clicking between
              // point inputs shouldn't save early).
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void commit();
              }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[verticalOnly]}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {rows.map((row, i) => (
                    <SortablePointRow
                      key={row.id}
                      row={row}
                      index={i}
                      // "Point n" counts real points only, not the add box.
                      n={rows.slice(0, i + 1).filter((r) => r.id !== DRAFT_ID).length}
                      sortable={rows.length > 1}
                      saving={saving}
                      inputRef={row.id === DRAFT_ID ? newPointRef : undefined}
                      onChange={updatePoint}
                      onRemove={removePoint}
                      onAdd={addPoint}
                      onCancel={cancelEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <p className="px-2 pt-0.5 text-[11px] font-medium text-[var(--faint)]">
                {t("goal.charsLeft", { n: MAX_GOAL - total })}
              </p>
            </div>
          ) : (
            <div key="display" className="relative flex min-h-0 flex-1 flex-col">
              <div
                ref={scrollRef}
                onScroll={updateFade}
                // Native scrollbar hidden, same as the activity calendar's
                // own week list — there's nothing else here standing in for
                // it (no rail), just the bottom fade below and, once it
                // overflows, keyboard scrolling via the tabIndex updateFade
                // sets above.
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                  // No points yet: centre the "add a goal" prompt in
                  // whatever height this got matched to, instead of letting
                  // it sit pinned to the top of a mostly-empty card.
                  !shownPoints.length && "flex flex-col justify-center"
                )}
              >
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label={t("goal.edit")}
                  className={
                    shownPoints.length
                      ? "w-full rounded-[10px] px-2 py-1 text-left hover:bg-secondary"
                      : "w-full rounded-[10px] px-2 py-1 text-left text-[14px] font-medium text-[var(--faint)] hover:bg-secondary hover:text-muted-foreground"
                  }
                >
                  {shownPoints.length ? (
                    <ul className={cn("list-disc space-y-0.5 pl-4 break-words", POINT_TEXT_CLASS)}>
                      {shownPoints.map((p, i) => (
                        <li key={i}>
                          {p}
                          {counts[i] ? (
                            <span className="ml-2 inline-flex items-center gap-0.5 align-baseline whitespace-nowrap text-[12px] font-semibold tabular-nums text-primary">
                              <Check className="size-3" strokeWidth={3.5} aria-hidden />
                              {t(counts[i] === 1 ? "goal.achievedSession" : "goal.achievedSessions", { n: counts[i] })}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    t("goal.add")
                  )}
                </button>
              </div>
              {/* Bottom fade — visibility toggled by updateFade() above,
                  not Tailwind state classes, since it depends on a DOM
                  measurement rather than anything React already tracks. */}
              <div
                ref={fadeRef}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-[10px] bg-gradient-to-t from-card to-transparent opacity-0 transition-opacity"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** One editable point row. useSortable() is a hook, so it needs a component
 *  per row (same reason as the board rack's card). The grip handle alone is
 *  the drag surface — the rest of the row is a text input — with
 *  `touch-action: none` scoped to it so a touch drag doesn't scroll the
 *  page. Shown once there's a point besides the "add a point" box, which
 *  is the DRAFT_ID row here: same grip, a placeholder, and + in place of ×. */
function SortablePointRow({
  row,
  index,
  n,
  sortable,
  saving,
  inputRef,
  onChange,
  onRemove,
  onAdd,
  onCancel,
}: {
  row: PointRow;
  index: number;
  n: number;
  sortable: boolean;
  saving: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  const draft = row.id === DRAFT_ID;
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !sortable || saving,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reducedMotion ? undefined : transition,
      }}
      className={cn("flex items-center gap-1.5", isDragging && "relative z-10 opacity-80")}
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          disabled={saving}
          {...attributes}
          {...listeners}
          // Keeps focus where it is (Safari doesn't focus buttons on click),
          // so grabbing the handle never blurs the block into an early save.
          onMouseDown={(e) => e.preventDefault()}
          aria-label={t("goal.dragPoint", { point: row.text.trim() || t("goal.addPoint") })}
          className={cn(
            "-ml-1.5 shrink-0 touch-none rounded-full p-1.5 text-[var(--faint)] hover:bg-secondary hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-60",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
      )}
      <input
        ref={inputRef}
        autoFocus={index === 0}
        value={row.text}
        disabled={saving}
        placeholder={draft ? t("goal.placeholder") : undefined}
        aria-label={draft ? t("goal.addPoint") : t("goal.editPoint", { n })}
        onChange={(e) => onChange(row.id, e.target.value)}
        // No Enter shortcut on purpose: it clashed with Chinese
        // input methods (注音/倉頡 confirm candidates with Enter).
        // Saving happens when focus leaves the card; Escape cancels.
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        className={cn(
          "min-w-0 flex-1 rounded-[10px] border border-ring bg-background px-2 py-1.5 outline-none ring-4 ring-ring/15 disabled:opacity-60",
          POINT_TEXT_CLASS
        )}
      />
      {draft ? (
        <button
          type="button"
          disabled={saving || !row.text.trim()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onAdd}
          aria-label={t("goal.addPoint")}
          className="shrink-0 rounded-full p-1.5 text-primary hover:bg-secondary disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          disabled={saving}
          // Safari doesn't focus buttons on click, so without this the
          // input blurs to <body> and the blur-to-save never fires.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onRemove(row.id)}
          aria-label={t("goal.removePoint", { point: row.text })}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The goal box in the log form / edit panel: one checkbox per point —
 *  ticked = achieved this session. `options` and `value` are the points'
 *  own wording (see lib/goal.ts: a session records only what was ticked),
 *  so the same box works on any session, whenever it was logged. */
export function GoalCheck({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useLang();
  return (
    <fieldset className="flex flex-col gap-2 rounded-[var(--r-tile)] bg-secondary px-4 py-3">
      <legend className="sr-only">{t("goal.whichDidYouAchieve")}</legend>
      <span className="text-xs font-semibold text-muted-foreground">{t("goal.whichDidYouAchieve")}</span>
      <div className="flex flex-col gap-1">
        {options.map((p) => {
          const checked = value.includes(p);
          return (
            <label
              key={p}
              className="flex cursor-pointer items-start gap-2.5 rounded-[10px] px-1 py-1 hover:bg-background/60"
            >
              <input
                type="checkbox"
                checked={checked}
                // Rebuilt from `options` so the saved list keeps their order.
                onChange={(e) => onChange(options.filter((o) => (o === p ? e.target.checked : value.includes(o))))}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-ring/30",
                  checked ? "border-primary bg-primary text-white" : "border-border bg-background"
                )}
              >
                {checked && <Check className="size-3" strokeWidth={3.5} />}
              </span>
              <span className="min-w-0 text-[14.5px] font-bold leading-snug break-words">{p}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Session card: the goal points ticked as achieved, as a section under the
 *  board chip (2026-10-06, on request; was a chip). One tick for the whole
 *  section (aligned to the first line), then the points as inline text with a
 *  dotted divider TRAILING each point but the last. The points are plain
 *  inline flow, so a wrap happens between items and every wrapped line starts
 *  flush with the first line's text; the divider stays at the end of the line
 *  above. It is glued to its point with a word joiner (U+2060) before an
 *  inline-block, so even a long point that breaks inside itself keeps the dots
 *  after its last word, never alone on a line. Between items is one ordinary
 *  space (widened with word-spacing): a space at a line end collapses, so
 *  the gap can't force a premature wrap, and at a line start it vanishes, so
 *  nothing indents. Width: `w-fit` shrinks the tile to its content when
 *  everything fits on one line (a pill like BoardChip); once the text is
 *  wider than the available space (card minus the mx-6 insets, which
 *  `max-w` states explicitly) the tile fills that width and the text wraps.
 *  Sized to line up with BoardChip: 20px icon, 4px inset, 8px gap, 13.5px
 *  bold text. A session records only the points that were ticked
 *  (lib/goal.ts), so there is no "missed" state and no "2 of 3" to show. */
export function GoalSection({ achieved }: { achieved: string[] }) {
  const { t } = useLang();
  if (!achieved.length) return null;
  return (
    <section
      data-goal-section
      className="mx-6 mt-1.5 mb-0.5 flex w-fit max-w-[calc(100%-3rem)] items-start gap-2 rounded-[var(--r-tile)] bg-secondary py-1 pr-3 pl-1"
    >
      {/* Main blue + white, same tick as the board rack's 常用/Go-to badge.
          Same 20px / 4px-inset geometry as BoardChip's photo, pinned to the
          first text line (items-start). */}
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <Check className="size-3" strokeWidth={3.5} />
      </span>
      {/* 24px lines with -my-0.5: a single line still occupies 20px (matches
          the tick), wrapped lines get 4px between them. */}
      <ul
        role="list"
        aria-label={t("goal.achieved")}
        className="-my-0.5 min-w-0 flex-1 text-[13.5px] font-bold leading-6 tracking-[-0.01em] break-words"
      >
        {achieved.map((p, i) => (
          <li key={p} className="inline">
            {p}
            {i < achieved.length - 1 && (
              <>
                {/* Three 2px dots down 10px (4px cells), in the main blue.
                    align-top + mt-[7px] centres it on the 24px line box. */}
                {"\u2060"}
                <span
                  aria-hidden
                  className="ml-2.5 inline-block h-2.5 w-0.5 mt-[7px] align-top"
                  style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 1.2px)",
                    backgroundSize: "2px 4px",
                    backgroundRepeat: "repeat-y",
                  }}
                />
                <span className="[word-spacing:0.375rem]"> </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
