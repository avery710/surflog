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
import { PillNeck } from "@/components/pill-neck";
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
  readOnly = false,
}: {
  goal: string | null;
  sessions: Session[];
  /** Static display (landing demo): no edit/drag affordances, no hover tint. */
  readOnly?: boolean;
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
  // a handle (or, in the read view, a goal pill) becomes a drag, plus keyboard (Space, arrows, Space).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
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
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  const counts = achievedCounts(pendingOrder ?? goalPoints(goal), sessions);

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

  // Reorder from the read view: optimistic, then the same save as an edit
  // (no renames). onSave toasts and resolves false on failure, in which case
  // dropping pendingOrder rolls the list back to the saved order.
  async function handleDisplayDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || saving) return;
    const current = pendingOrder ?? goalPoints(goal);
    const ids = current.map((_, i) => displayIds[i]);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(current, from, to);
    setPendingOrder(next);
    setSaving(true);
    await onSave(joinGoalPoints(next), []);
    setSaving(false);
    setPendingOrder(null);
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

  // Optimistic order while a drag-reorder is being saved (see
  // handleDisplayDragEnd); null otherwise.
  const shownPoints = pendingOrder ?? goalPoints(goal);
  // Stable sortable ids: the text, numbered when a point repeats.
  const seen = new Map<string, number>();
  const displayIds = shownPoints.map((p) => {
    const n = seen.get(p) ?? 0;
    seen.set(p, n + 1);
    return n ? `${p}\u0000${n}` : p;
  });
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
                {shownPoints.length ? (
                  // The card is no longer one big <button> (a drag handle can't
                  // nest inside one): an overlay button underneath takes every
                  // click that isn't on a handle, the list sits above it with
                  // pointer-events off except on the handles, so clicking a
                  // pill still opens edit mode and keeps the hover tint.
                  <div className="relative">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={startEdit}
                        aria-label={t("goal.edit")}
                        className="absolute inset-0 rounded-[10px] hover:bg-secondary/40"
                      />
                    )}
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[verticalOnly]}
                      onDragEnd={handleDisplayDragEnd}
                    >
                      <SortableContext items={displayIds} strategy={verticalListSortingStrategy}>
                        <ul role="list" className="pointer-events-none relative space-y-1.5 py-1">
                          {shownPoints.map((p, i) => (
                            <DisplayPointItem
                              key={displayIds[i]}
                              id={displayIds[i]}
                              text={p}
                              count={counts[i]}
                              sortable={!readOnly && shownPoints.length > 1}
                              onEdit={startEdit}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </div>
                ) : readOnly ? (
                  <p className="px-2 py-1 text-[14px] font-medium text-[var(--faint)]">{t("goal.add")}</p>
                ) : (
                  <button
                    type="button"
                    onClick={startEdit}
                    aria-label={t("goal.edit")}
                    className="w-full rounded-[10px] px-2 py-1 text-left text-[14px] font-medium text-[var(--faint)] hover:bg-secondary hover:text-muted-foreground"
                  >
                    {t("goal.add")}
                  </button>
                )}
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

/** One read-view goal item: [text pill] - neck - [count pill]. With 2+ points
 *  the text pill is the drag surface (a 6px activation distance keeps a plain
 *  click working, which opens edit mode via onEdit); the count pill and the
 *  gaps stay pointer-transparent so they fall through to the edit overlay. */
function DisplayPointItem({
  id,
  text,
  count,
  sortable,
  onEdit,
}: {
  id: string;
  text: string;
  count: number;
  sortable: boolean;
  onEdit: () => void;
}) {
  const { t } = useLang();
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !sortable,
  });
  const pill =
    "relative block rounded-[14px] bg-secondary px-3.5 py-1 text-[13.5px] font-bold leading-5 tracking-[-0.01em] break-words";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: reducedMotion ? undefined : transition }}
      className={cn("flex w-fit max-w-full items-center gap-x-[3.5px]", isDragging && "relative z-10 opacity-80")}
    >
      <span className="relative min-w-0">
        {sortable ? (
          <span
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            onClick={onEdit}
            aria-label={t("goal.dragPoint", { point: text })}
            className={cn(
              pill,
              "pointer-events-auto touch-none focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            {text}
          </span>
        ) : (
          <span className={pill}>{text}</span>
        )}
      </span>
      {count ? (
        <span className="relative shrink-0">
          <PillNeck className="absolute top-1/2 -left-[5.5px] -mt-[15px]" />
          <span className="relative flex h-7 items-center gap-0.5 rounded-[14px] bg-secondary px-3 text-[13.5px] font-bold tabular-nums whitespace-nowrap text-primary">
            <Check className="size-3" strokeWidth={3.5} aria-hidden />
            <span aria-hidden>{count}</span>
            <span className="sr-only">
              {t(count === 1 ? "goal.achievedSession" : "goal.achievedSessions", { n: count })}
            </span>
          </span>
        </span>
      ) : null}
    </li>
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

/** Session card: the goal points ticked as achieved, under the board chip
 *  (2026-10-06, on request). A wrapping chain of grey shapes like the board
 *  chip: [tick circle] - [goal 1] - [goal 2] ... Every goal pill has exactly
 *  one stem (`PillNeck`): horizontal to its left neighbour when they share a
 *  line, else vertical up to the first shape of the line above (the tick
 *  circle for line 2, the first pill of line 2 for line 3, ...), all on one
 *  straight spine (x=15). The tick is the section's one icon (blue badge in a
 *  30px grey circle, the chip's photo-circle pattern); pills are text only,
 *  radius 14px, text wraps inside, never truncated. A pill that wraps its own
 *  text always starts a line (flex-wrap moves an item that doesn't fit on one
 *  line down), so it never sits beside a neighbour, and `items-start` rows
 *  are exactly as tall as their first shape, which keeps the 7px row gap the
 *  vertical stem is drawn for. CSS can't know where a row wraps, so
 *  `useLayoutEffect` + a ResizeObserver (list, items, and again when fonts
 *  load) set `data-neck` straight on each li (DOM attribute, no React state):
 *  left | up-circle | up-pill. SSR and first paint have none, so no stem is
 *  ever drawn in the wrong place. A session records only the points that were
 *  ticked (lib/goal.ts), so no "missed" state. */
export function GoalSection({ achieved }: { achieved: string[] }) {
  const { t } = useLang();
  const listRef = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const ul = listRef.current;
    if (!ul) return;
    const update = () => {
      const items = Array.from(ul.children) as HTMLElement[];
      let lineStart = 0; // index of the first shape on the current line
      items.forEach((li, i) => {
        if (i === 0) return;
        let state: string;
        if (li.offsetLeft > items[i - 1].offsetLeft) state = "left";
        else {
          state = lineStart === 0 ? "up-circle" : "up-pill";
          lineStart = i;
        }
        if (li.getAttribute("data-neck") !== state) li.setAttribute("data-neck", state);
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ul);
    Array.from(ul.children).forEach((c) => ro.observe(c));
    void document.fonts?.ready.then(update);
    return () => ro.disconnect();
  }, [achieved]);
  if (!achieved.length) return null;
  return (
    <section data-goal-section className="mx-6 mt-1.5 mb-0.5 max-w-[calc(100%-3rem)]">
      <ul
        ref={listRef}
        role="list"
        aria-label={t("goal.achieved")}
        className="flex w-fit max-w-full flex-wrap items-start gap-x-[3.5px] gap-y-[7px]"
      >
        <li aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-secondary">
          {/* Main blue + white, same tick as the board rack's 常用/Go-to badge. */}
          <span className="flex size-[22px] items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" strokeWidth={3.5} />
          </span>
        </li>
        {achieved.map((p) => (
          <li key={p} className="group relative min-w-0 max-w-full self-center">
            {/* Stems first in the li, so the pill's own text paints above. */}
            <PillNeck className="absolute top-1/2 -left-[5.5px] -mt-[15px] hidden group-data-[neck=left]:block" />
            <PillNeck
              direction="vertical"
              top="circle"
              className="absolute -top-[9.2px] left-[6px] hidden group-data-[neck=up-circle]:block"
            />
            <PillNeck
              direction="vertical"
              top="pill"
              className="absolute -top-[9.2px] left-[6px] hidden group-data-[neck=up-pill]:block"
            />
            <span className="relative block rounded-[14px] bg-secondary px-3.5 py-1 text-[13.5px] font-medium leading-5 tracking-[-0.01em] break-words">
              {p}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
