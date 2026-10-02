"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, MoreHorizontal, Pencil, Star, Trash2, X } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MAX_BOARD_NOTE,
  MAX_BRAND,
  ROCKERS,
  boardLabel,
  formatLength,
  formatVolume,
  joinLength,
  sortBoards,
  splitLength,
} from "@/lib/boards";
import { useLang } from "@/lib/i18n";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import type { Board, Rocker } from "@/lib/types";

/**
 * "Your board rack" — the owner's boards, with add / edit / delete. Sits
 * below the Activity calendar and "What you've surfed" table. State lives in
 * Journal (sessions need the list too); this component does the fetches.
 */
export function BoardRack({
  boards,
  onSaved,
  onDeleted,
  onRackChanged,
}: {
  boards: Board[];
  onSaved: (b: Board) => void;
  onDeleted: (id: string) => void;
  /** The whole rack, replaced — used for anything touching more than one
   *  board at once: the 常用 toggle (optimistic update + reconcile/
   *  rollback) and drag-and-drop reorder (optimistic reorder + reconcile/
   *  rollback), both in this file. */
  onRackChanged: (boards: Board[]) => void;
}) {
  const { t } = useLang();
  // null = closed, "new" = adding, otherwise the board being edited
  const [editing, setEditing] = useState<Board | "new" | null>(null);
  // Delete now goes through a confirm dialog (like entry-card's), not an
  // inline "really delete?" toggle — there's no room for that second state
  // inside a dropdown menu item.
  const [confirmBoard, setConfirmBoard] = useState<Board | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 常用 / go-to: any number of boards; they're listed first. (Not what the
  // log form pre-selects — that's the last-used board, preselectBoardId().)
  // Optimistic (2026-09-30, on request — the round trip was taking
  // 0.6-1.7 s and the badge/reorder felt laggy): flip it locally first so
  // the badge and the favourites-first order update immediately, then
  // reconcile with the server's copy of just that one board; on failure,
  // put the pre-toggle rack back and toast.
  const [sorting, setSorting] = useState(false);
  // Leaves 排序 mode by itself if the rack drops below two boards.
  const sortingOn = sorting && boards.length >= 2;

  async function toggleFavorite(board: Board) {
    const next = !board.isFavorite;
    const optimistic = boards.map((b) => (b.id === board.id ? { ...b, isFavorite: next } : b));
    onRackChanged(optimistic);
    try {
      const res = await fetch(`/api/boards/${board.id}/favorite`, {
        method: next ? "PUT" : "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSetFavorite"));
      const updated = body.board as Board;
      onRackChanged(optimistic.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e) {
      onRackChanged(boards);
      toast.error(e instanceof Error ? e.message : t("toast.couldntSetFavorite"));
    }
  }

  // Drag-and-drop reorder (2026-09-30). Boards drag only within their own
  // group — 常用 boards always stay first (CLAUDE.md "Board rack"), so a
  // drop onto the other group is ignored rather than toggling 常用: the
  // dragged card just animates back to its last in-group slot, since
  // nothing in state changes. This is the only thing enforcing that —
  // there's one <SortableContext> covering every card (see render below,
  // and "one flat list" below for why two was the wrong shape), so this
  // check is load-bearing for every drag, not just a keyboard backstop.
  const sensors = useSensors(
    // Pointer covers mouse and touch; a drag handle with touch-action:none
    // (see SortableBoardCard) is what keeps touch drags from also
    // scrolling the page, per dnd-kit's own "drag handle" pattern. A small
    // activation distance stops a plain tap/scroll-starting touch on the
    // handle from being read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Keyboard: Tab to a handle, Space to pick up, Arrow Up/Down to move,
    // Space to drop, Escape to cancel — dnd-kit's default keyboard sensor
    // behaviour, unmodified.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = sortBoards(boards);
    const activeBoard = current.find((b) => b.id === active.id);
    const overBoard = current.find((b) => b.id === over.id);
    if (!activeBoard || !overBoard || activeBoard.isFavorite !== overBoard.isFavorite) return;

    // Reorder just the active board's group, then splice it back into the
    // full rack — the other group's slots (and its own contiguous block,
    // favourites-first) are untouched.
    const groupIds = current.filter((b) => b.isFavorite === activeBoard.isFavorite).map((b) => b.id);
    const reorderedGroup = arrayMove(groupIds, groupIds.indexOf(active.id as string), groupIds.indexOf(over.id as string));
    let gi = 0;
    const fullOrder = current.map((b) => (b.isFavorite === activeBoard.isFavorite ? reorderedGroup[gi++] : b.id));

    const byId = new Map(boards.map((b) => [b.id, b]));
    const optimistic = fullOrder.map((id) => byId.get(id)!);
    onRackChanged(optimistic);

    void (async () => {
      try {
        const res = await fetch("/api/boards/order", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: fullOrder }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? t("toast.couldntReorder"));
        onRackChanged(body.boards as Board[]);
      } catch (e) {
        onRackChanged(boards);
        toast.error(e instanceof Error ? e.message : t("toast.couldntReorder"));
      }
    })();
  }

  async function confirmDelete() {
    const board = confirmBoard;
    if (!board) return;
    setDeletingId(board.id);
    try {
      const res = await fetch(`/api/boards/${board.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("toast.couldntDelete"));
      onDeleted(board.id);
      toast.success(t("toast.boardDeleted"));
      setConfirmBoard(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  // One flat, favourites-first order (sort_order within each group) — see
  // "one flat list" in the render below for why this feeds a single
  // <SortableContext> rather than one per group.
  const ordered = sortBoards(boards);
  const orderedIds = ordered.map((b) => b.id);

  return (
    // No mt here — this card sits inside journal.tsx's shared dashboard
    // panel now, which spaces its sections itself (gap-4).
    <section>
      <div className="rounded-[var(--r-card)] border border-card-border bg-card p-2">
        <div className="flex items-center justify-between gap-3 py-1 pr-1 pl-3">
          <h2 className="font-sans text-[13px] font-bold text-muted-foreground">
            {t("section.boards")}
          </h2>
          {/* 排序 mode (option D, 2026-09-30): the ⋮⋮ drag handles only
              appear after tapping 排序 / Reorder, so the cards stay quiet
              the rest of the time. Only offered with 2+ boards; while it's
              on, 完成 / Done replaces the header buttons and each card's ⋯
              menu is hidden, so a tap can't open a menu mid-sort. */}
          <div className="flex items-center gap-1.5">
            {sortingOn ? (
              <Button size="sm" className="rounded-full" onClick={() => setSorting(false)}>
                {t("board.sortDone")}
              </Button>
            ) : (
              <>
                {boards.length >= 2 && (
                  <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setSorting(true)}>
                    {t("board.sort")}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setEditing("new")}
                >
                  {t("board.add")}
                </Button>
              </>
            )}
          </div>
        </div>
        {sortingOn && (
          <p className="px-3 pb-1 text-[12.5px] font-medium text-muted-foreground">{t("board.sortHint")}</p>
        )}
        {boards.length === 0 ? (
          <p className="px-3 pt-1 pb-3 text-[14px] font-medium text-muted-foreground">{t("board.empty")}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {/* ONE flat list/SortableContext for every card, favourites
                  first (used to be two SortableContexts, one per group).
                  That split caused a visible flash whenever a card's
                  favourite status flipped: React reconciles each .map()'s
                  children against its OWN parent, so a card moving from
                  the favourites array to the others array (or back) was a
                  different parent subtree either way — unmount + remount
                  despite the unchanged key, reloading the photo <img> and
                  re-mounting useSortable. One array + one context means
                  the card just changes position within the SAME keyed
                  list, which React reorders in place. The favourites-only
                  / others-only *drag* grouping still holds — enforced in
                  handleDragEnd's cross-group no-op guard below — just not
                  by separate contexts any more. rectSortingStrategy, not
                  the vertical-list one, because this grid is 2-up from
                  sm. */}
              <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
                {ordered.map((b) => (
                  <SortableBoardCard
                    key={b.id}
                    board={b}
                    t={t}
                    onEdit={setEditing}
                    onToggleFavorite={toggleFavorite}
                    onDeleteRequest={setConfirmBoard}
                    sorting={sortingOn}
                  />
                ))}
              </SortableContext>
            </ul>
          </DndContext>
        )}
      </div>

      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg" closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t(editing === "new" ? "board.addTitle" : "board.editTitle")}</DialogTitle>
          </DialogHeader>
          {editing != null && (
            <BoardForm
              key={editing === "new" ? "new" : editing.id}
              board={editing === "new" ? null : editing}
              onSaved={(b) => {
                onSaved(b);
                setEditing(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation — a dialog, not the old inline "really
          delete?" toggle, now that Delete lives inside the overflow menu. */}
      <Dialog
        open={confirmBoard != null}
        onOpenChange={(open) => {
          if (!open && deletingId == null) setConfirmBoard(null);
        }}
      >
        <DialogContent closeLabel={t("entry.close")}>
          <DialogHeader>
            <DialogTitle>{t("board.deleteTitle")}</DialogTitle>
            {confirmBoard && (
              <DialogDescription>
                {t("board.deleteDescription", { name: boardLabel(confirmBoard) })}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => setConfirmBoard(null)}
              disabled={deletingId != null}
            >
              {t("edit.cancel")}
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={() => void confirmDelete()}
              disabled={deletingId != null}
            >
              {deletingId != null ? t("entry.deleting") : t("entry.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** One draggable board card. Split out of BoardRack's render because
 *  useSortable() is a hook — it has to run once per card component
 *  instance, not once per loop iteration inside .map(). */
function SortableBoardCard({
  board: b,
  t,
  onEdit,
  onToggleFavorite,
  onDeleteRequest,
  sorting,
}: {
  board: Board;
  t: ReturnType<typeof useLang>["t"];
  onEdit: (b: Board) => void;
  onToggleFavorite: (b: Board) => void;
  onDeleteRequest: (b: Board) => void;
  /** 排序 mode: show the ⋮⋮ handle (and hide ⋯). Dragging is off otherwise. */
  sorting: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id,
    disabled: !sorting,
  });
  const reducedMotion = usePrefersReducedMotion();
  const name = boardLabel(b);
  const specs = [
    formatLength(b.lengthIn),
    formatVolume(b.volumeL),
    b.rocker ? t("board.rockerValue", { r: t(`board.rocker.${b.rocker}`) }) : null,
  ].filter(Boolean);
  // 常用 badge — shown only on go-to boards. Outside 排序 mode it's also the
  // un-favourite control: clicking it calls the same toggleFavorite() the
  // ⋯ menu's "取消常用" item uses (2026-09-30 → extended here), since the
  // badge only ever appears on favourites, a click can only mean "remove".
  // The ✓ swaps to an × on hover/focus so the badge still reads as a quiet
  // status label at rest, but signals "clickable, this removes" once you're
  // on it (group-hover/group-focus-visible on the two icons; the badge
  // itself carries `group`). While sorting, the whole card is the drag
  // surface and the ⋯ menu is hidden, so the badge must stay a plain
  // non-interactive <span> here too — a drag starting on it must never be
  // read as a click, and must never fire the toggle mid-drag.
  const favoriteBadge = b.isFavorite && (
    sorting ? (
      <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
        <Check className="size-3" aria-hidden />
        {t("board.favorite")}
      </span>
    ) : (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(b);
        }}
        aria-label={t("board.removeFavoriteLabel", { name })}
        className="group inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:bg-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Check className="size-3 group-hover:hidden group-focus-visible:hidden" aria-hidden />
        <X className="hidden size-3 group-hover:block group-focus-visible:block" aria-hidden />
        {t("board.favorite")}
      </button>
    )
  );

  return (
    // In 排序 mode the whole card is the drag surface (on request
    // 2026-09-30 — was the ⋮⋮ handle only): dnd-kit's listeners and the
    // keyboard attributes (tabindex, role, aria) go on the <li> itself, and
    // `touch-none` is on the card only while sorting, so outside the mode
    // swiping over a card still scrolls the page. Trade-off: while sorting on
    // a phone, a swipe that starts on a card drags it instead of scrolling.
    <li
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.6 : undefined,
      }}
      {...(sorting ? { ...attributes, ...listeners, "aria-label": t("board.dragHandle", { name }) } : {})}
      className={
        "relative grid min-w-0 grid-cols-1 gap-2 rounded-[var(--r-tile)] bg-secondary p-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-3" +
        (sorting
          ? " cursor-grab touch-none select-none outline-none ring-primary/40 focus-visible:ring-4 active:cursor-grabbing" +
            (isDragging ? " shadow-lg" : "")
          : "")
      }
    >
      {/*
        Three breakpoints share this one wrapper (`lg:contents`
        makes it disappear at lg so the photo and text column
        become direct children of the li's grid again):
        - below sm (phone, one rack column, narrow): stacked in
          one column, left-aligned — photo on top, full card
          width, then name/specs/note below it. The image itself
          is 100% wide with its natural height (a plain static
          <img>, `h-auto`) — on request 2026-09-30, after a
          fixed 112px-tall letterboxed box. Safe here because
          nothing stretches it: this is a one-column stack, not
          the stretched row that blew up in WebKit (see below).
          Nothing is cropped; a tall portrait photo makes a tall
          card. A board with no photo renders no box at all here
          (`hidden`), not an empty placeholder square.
        - sm to lg (the 2-up rack grid, still a narrow column
          per board): unchanged from before this pass — photo
          beside name/specs/note in a 2-col row
          (`sm:grid-cols-[auto_minmax(0,1fr)]`), photo matching
          that row's height, `object-cover`. Kept as-is rather
          than stacked too: it already fit this width, and
          stacking every 2-up card would make the rack much
          taller for no clarity gain.
        - lg: photo left of a column with name row (⠿ handle ·
          name · 常用 badge · ⋯), specs, note; photo matching that
          column's height. There's no separate button row any
          more at any breakpoint.
        The image is absolutely positioned inside a wrapper, so
        its own (large) pixel size can't drive the layout — a
        plain <img> with aspect-square + stretch did the
        opposite in WebKit (2026-09-30): the photo grew to its
        natural size and squeezed the text to one character
        wide. At sm+ the wrapper is capped at 96px and fills
        the row (h-full, width from aspect-square) to match the
        text column; a board with a note (or a narrow phone)
        makes that column tall, and an uncapped photo would
        grow and squeeze the text further.
      */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] lg:contents">
        <div
          className={
            "relative w-full overflow-hidden rounded-[12px] bg-background sm:aspect-square sm:h-full sm:max-h-24 sm:min-h-16 sm:min-w-16 sm:max-w-24 sm:w-auto" +
            (b.photoId ? "" : " hidden sm:block")
          }
        >
          {b.photoId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/blob/${b.photoId}`}
              alt={t("board.photoAlt", { name })}
              loading="lazy"
              className="block h-auto w-full sm:absolute sm:inset-0 sm:size-full sm:object-cover"
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Name row: name, the 常用 badge (go-to boards only), and ⋯ at
              the far right; the name truncates first. In 排序 mode ⋯ is
              hidden — the whole card is the drag surface then (see the
              <li>), with no handle icon. ⋯ has no fill at rest; the
              round background only shows on hover / while open. */}
          <div className="flex min-w-0 items-center gap-2">
            {/* leading-6 (24px) matches the 常用 badge's h-6 exactly, so the
                row's height — and the specs/note lines below it — don't
                shift by the ~2px gap between the text's own line box and
                the badge when the badge appears/disappears (Avery's
                report, 2026-10-01). Truncate still keeps it one line. */}
            <span className="min-w-0 truncate text-[15px] leading-6 font-bold tracking-[-0.015em]">
              {b.brand || name}
            </span>
            {favoriteBadge}
            <span className="flex-1" />
            {!sorting && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="-my-1.5 -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 aria-expanded:bg-muted aria-expanded:text-foreground lg:size-7"
                  aria-label={t("board.actionsLabel", { name })}
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onToggleFavorite(b)}>
                    <Star />
                    {b.isFavorite ? t("board.unsetFavorite") : t("board.setFavorite")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onEdit(b)}>
                    <Pencil />
                    {t("entry.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onDeleteRequest(b)}
                    variant="destructive"
                  >
                    <Trash2 />
                    {t("entry.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {specs.length > 0 && (
            <span className="font-mono text-[12.5px] text-muted-foreground">{specs.join(" · ")}</span>
          )}
          {b.note && (
            <span className="line-clamp-2 text-[13px] leading-snug break-words text-muted-foreground">
              {b.note}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

const NO_ROCKER = "__none__";

function BoardForm({ board, onSaved }: { board: Board | null; onSaved: (b: Board) => void }) {
  const { t } = useLang();
  const initialLength = splitLength(board?.lengthIn);
  const [brand, setBrand] = useState(board?.brand ?? "");
  const [ft, setFt] = useState(initialLength.ft);
  const [inches, setInches] = useState(initialLength.inches);
  const [volume, setVolume] = useState(board?.volumeL != null ? String(board.volumeL) : "");
  const [rocker, setRocker] = useState<Rocker | null>(board?.rocker ?? null);
  const [note, setNote] = useState(board?.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Free the object URL when it's replaced or the form closes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setRemovePhoto(false);
  }

  function clearPhoto() {
    setFile(null);
    setPreviewUrl(null);
    setRemovePhoto(true);
  }

  const shownPhoto = previewUrl ?? (!removePhoto && board?.photoId ? `/api/blob/${board.photoId}` : null);

  async function handleSave() {
    const lengthIn = joinLength(ft, inches);
    if (Number.isNaN(lengthIn)) {
      toast.error(t("board.lengthInvalid"));
      return;
    }
    const volumeL = volume.trim() ? Number(volume) : null;
    if (volumeL != null && (!Number.isFinite(volumeL) || volumeL <= 0 || volumeL > 300)) {
      toast.error(t("board.volumeInvalid"));
      return;
    }
    if (!brand.trim() && lengthIn == null) {
      toast.error(t("board.needBrandOrLength"));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(board ? `/api/boards/${board.id}` : "/api/boards", {
        method: board ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, lengthIn, volumeL, rocker, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? t("toast.couldntSaveBoard"));
      let saved = body.board as Board;

      // Photo is a second request, once the board exists (it needs an id).
      try {
        if (file) {
          const form = new FormData();
          form.append("file", file);
          const r = await fetch(`/api/boards/${saved.id}/photo`, { method: "POST", body: form });
          const b = await r.json();
          if (!r.ok) throw new Error(b?.error);
          saved = b.board as Board;
        } else if (removePhoto && saved.photoId) {
          const r = await fetch(`/api/boards/${saved.id}/photo`, { method: "DELETE" });
          const b = await r.json();
          if (!r.ok) throw new Error(b?.error);
          saved = b.board as Board;
        }
      } catch {
        onSaved(saved);
        toast.error(t("toast.boardPhotoFailed"));
        return;
      }

      onSaved(saved);
      toast.success(t("toast.boardSaved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("toast.couldntSaveBoard"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FormField label={t("board.brand")}>
        <Input
          value={brand}
          maxLength={MAX_BRAND}
          placeholder={t("board.brandPlaceholder")}
          onChange={(e) => setBrand(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <div className="col-span-2 flex min-w-0 flex-col gap-1.5 sm:col-span-1">
          <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("board.length")}</span>
          <div className="flex items-center gap-1.5">
            <Input
              inputMode="numeric"
              value={ft}
              placeholder="6"
              aria-label={t("board.lengthFeet")}
              onChange={(e) => setFt(e.target.value)}
              className="font-mono"
            />
            <span className="font-mono text-sm text-muted-foreground">&apos;</span>
            <Input
              inputMode="decimal"
              value={inches}
              placeholder="2"
              aria-label={t("board.lengthInches")}
              onChange={(e) => setInches(e.target.value)}
              className="font-mono"
            />
            <span className="font-mono text-sm text-muted-foreground">&quot;</span>
          </div>
        </div>
        <FormField label={`${t("board.volume")} (L)`}>
          <Input
            inputMode="decimal"
            value={volume}
            placeholder="32.5"
            onChange={(e) => setVolume(e.target.value)}
            className="font-mono"
          />
        </FormField>
        <FormField label={t("board.rocker")}>
          <Select
            value={rocker ?? NO_ROCKER}
            onValueChange={(v) => setRocker(v === NO_ROCKER ? null : (v as Rocker))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ROCKER}>{t("board.rocker.none")}</SelectItem>
              {ROCKERS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`board.rocker.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label={t("board.note")}>
        <Textarea
          value={note}
          maxLength={MAX_BOARD_NOTE}
          placeholder={t("board.notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>

      <div className="flex flex-col gap-1.5">
        <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{t("board.photoOptional")}</span>
        <div className="flex flex-wrap items-center gap-3">
          {shownPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownPhoto}
              alt={t("board.photoAlt", { name: boardLabel({ brand, lengthIn: joinLength(ft, inches) || null }) })}
              className="size-16 rounded-[12px] bg-secondary object-cover"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => fileRef.current?.click()}
          >
            {shownPhoto ? t("board.changePhoto") : t("board.choosePhoto")}
          </Button>
          {shownPhoto && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={clearPhoto}
            >
              {t("board.removePhoto")}
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>
      </div>

      <div>
        <Button onClick={handleSave} disabled={saving} className="rounded-full px-6">
          {saving ? t("form.saving") : t("board.save")}
        </Button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="pl-0.5 text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
