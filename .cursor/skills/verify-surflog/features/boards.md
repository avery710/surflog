# Board rack

The journal block headed `Your board rack` (`components/board-rack.tsx`). Boards are private rows (`boards` table). The log form pre-selects the last-used board.

## Sub-features

- Empty copy when the rack has no boards, otherwise one card per board: brand, length in feet and inches (stored as inches), volume in litres, rocker, note, optional photo.
- `+ Add board` opens a dialog titled `Add a board`. Save button `Save board`. Brand field label `Brand`. At least a brand or a length is required.
- Card menu `aria-label` `Actions for {name}`: edit, delete, `Mark as go-to` / `Remove from go-to`.
- `Reorder` makes the cards draggable (`aria-label` `Drag to reorder {name}`). Go-to boards stay first. A drop into the wrong group snaps back.
- Photo: `Choose photo` on the dialog, uploaded only after the board row exists, via `POST /api/boards/:id/photo` with an `{ uploadId }` from `POST /api/uploads`.

## How to get to it (user POV)

Sign in and open `/`. Scroll to `Your board rack`. The landing page shows a demo rack inside an `inert` container; that one cannot be saved.

## Driving it with Chrome

Same sign-in and Supabase precondition as sessions. If the rack is the landing demo (header button says `Sign in`, and the rack's ancestor is `inert`), stop. Failure reason: not signed in. Do not use `/dev/board-rack`.

1. Scroll to the heading `Your board rack`. Note how many cards are there.
2. Click `+ Add board`. Dialog title `Add a board`.
3. Fill `Brand` with a unique value `verify-surflog-board`. Leave length empty or set feet/inches. Click `Save board`.
4. The dialog closes and a card showing `verify-surflog-board` is in the rack. `POST /api/boards` returned `201` and `{ board }` with that brand and this user's `ownerId`.
5. Open `Actions for verify-surflog-board` and delete it. Confirm the delete dialog (`Delete this board?`). The card is gone and the rack count matches step 1.
6. `GET /api/boards` (cookie session) no longer lists that id.

**End state.** The probe board was created, rendered in the rack, and deleted. The rack matches the count from before the run. No go-to flag and no photo were required for this pass; if a photo was added, the storage object is gone with the board.

## Gotchas

- The landing rack is `inert` and its boards come from `components/landing/demo-data.ts` (Haydenshapes, Wavestorm). Seeing those names does not mean a `boards` row exists.
- Length is feet and inches in the form and inches in the database. Volume is litres. Do not type centimetres or pounds.
- `PUT /api/boards/order` replaces the whole order and `404`s unless the id list is exactly the caller's rack. A reorder probe must send the full list and put it back.
- Deleting a board sets `sessions.board_id` to null on sessions that used it. Do not delete a board the account actually surfs. Only delete the `verify-surflog-board` row this journey created.
- `is_default` is unread. Do not assert on it.
