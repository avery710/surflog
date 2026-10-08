/** Shared look of the dashboard's inline text fields — a goal point being
 *  edited (components/goal.tsx) and a spot description being edited
 *  (components/patterns-table.tsx): grey fill, 10px radius, 28px tall with
 *  `leading-5`, a 1.5px ring-coloured border as the focus style (no outer ring).
 *  Each caller adds its own text style so the field's text matches its
 *  read-view text (size/weight differ between the two). Padding is the same
 *  as FIELD_IDLE's, so the read view's button doesn't shift on entering edit. */
export const INLINE_FIELD =
  "rounded-[10px] border-[1.5px] border-ring bg-secondary px-3 py-[2px] leading-5 outline-none disabled:opacity-60";

/** The read-view button that opens an INLINE_FIELD: same box (transparent
 *  border), no fill until hover, and hover is the field's own grey — it must
 *  be `bg-secondary`, not `bg-background` (white on the white card made the
 *  hover look like the grey vanishing). */
export const INLINE_FIELD_IDLE =
  "rounded-[10px] border-[1.5px] border-transparent px-3 py-[2px] leading-5 hover:bg-secondary";
