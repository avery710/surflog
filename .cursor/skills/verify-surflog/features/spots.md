# Spot catalogue

`/spots` lists the shared `spots` table (`components/spots-overview.tsx`): search, groups, pin, and either `Add a spot` (emails in `SPOT_ADMIN_EMAILS`) or `Request a spot` (everyone else). A row links to `/spots/<slug>`.

## Sub-features

- Search box `aria-label` `Search spots`. The count under it is `data-testid="spot-count"` (`{count} spots`, or a match count while a query is set). No matches: `No spots match “…”`.
- Groups follow `lib/spot-browse.ts` (Siargao, Bali, then alphabetical). A `Pinned` section sits on top when this user has pins.
- Pin control `aria-label` `Pin {name}` / the unpin string. Private, max 50, `PUT` or `DELETE /api/spots/<slug>/pin`.
- Reviews: shared across signed-in users, one per user per spot, 1–5 stars required (`components/spot-reviews-dialog.tsx`).
- Non-admins suggest an edit; admins add and edit. A spot with sessions cannot be deleted.
- Spot page `/spots/<slug>`: Pin, `Log a session here` (opens the log dialog on that slug), About, this user's sessions, reviews.

## How to get to it (user POV)

Sign in. Avatar menu → `Surf spots`, or open `/spots` directly. Type in `Search spots`. Open a row. Pin it. Unpin it before the run ends if the pin was only for the check.

## Driving it with Chrome

Needs the same signed-in cookie and Supabase project as the session journey. If the browser is signed out, `/spots` redirects to `/signin?callbackUrl=%2Fspots` and the journey stops there. That redirect is doctor check, not a pass of this feature. Do not drive `/dev/spot-detail` instead.

1. Land on `/spots` with `<h1>` `Surf spots` (not the sign-in card).
2. Read `data-testid="spot-count"`. The number is greater than 0. The migrations seed Taiwan, Siargao, and Bali; an empty local database that has not been migrated fails here — apply `supabase/migrations/` and say so, do not stub the list.
3. Type `Jialeshui` into `Search spots`. The count line changes to a match count and a row whose text includes `Jialeshui` is visible. Clear the box (the × button, sr-only `Clear search`) and the full count returns.
4. Type `zzzz-not-a-spot`. The page shows `No spots match “zzzz-not-a-spot”.`
5. Clear, open the `Jialeshui` row, and confirm the URL is `/spots/jialeshui` and the heading names that spot.
6. Activate `Pin Jialeshui` (the aria-label is `Pin {name}`). Go back to `/spots`. A `Pinned` section lists it. `DELETE` it by activating the unpin control, and the section drops that spot. `GET` is not enough — the pin must round-trip and then be removed so the account is unchanged.

**End state.** Search filtered to `Jialeshui` and back, the spot page opened for slug `jialeshui`, a pin was stored for this user and then removed. The final pin list matches what it was before the run.

## Gotchas

- Signed out, step 1 fails. Record `redirected to /signin`. Do not pass the journey.
- `SPOT_ADMIN_EMAILS` decides `Add a spot` versus `Request a spot`. A non-admin must not see the admin add dialog. Do not request a brand-new spot as a probe; requests email nobody yet (`lib/spot-request-notify.ts` only logs) but they do write a `spot_requests` row.
- Pins need migration `20261009100000`. Until it is applied the toggle says pinning is not switched on. That is a failed precondition, not a UI tweak to ignore.
- Reviews are the one cross-user read. Do not post a review as a probe; it is visible to every signed-in user.
- Never invent coordinates. Adding a spot within 100 m of an existing one is refused; 100 m–1 km asks. This journey does not add a spot.
- "Near me" asks for the browser location only after the control is used. Deny or dismiss it; do not grant a fake position.
