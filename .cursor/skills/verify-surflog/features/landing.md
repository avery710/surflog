# Signed-out landing

The page a visitor gets at `/` with no session cookie (`app/page.tsx` renders `components/landing/landing.tsx`). Sign-in buttons call the same Google server action as `/signin`.

## Sub-features

- Hero and header `Sign in` button, plus the `EN` / `中文` toggle (`aria-pressed` buttons, group label `Language`).
- Section 01, heading `Your surf log, your best sidekick`: read-only goal card, activity calendar, "What you've surfed", and a board rack wrapped in `inert` so it cannot call the API.
- Section 02, heading `Conditions fill themselves`: a fake "You type" panel (spot `Jialeshui`, time `06:00`) beside a read-only session card.
- Section 03, heading `Bring your own AI app`: a static transcript that mentions `create_session` and `list_sessions`. It does not call `/api/mcp`.
- Section 04, heading `A world spot list, built by surfers`: three static mocks. A live count sentence is added only when `getLandingSpots()` could read `spots`.
- Section 05, heading `Share a session your way`: three sticker images from `public/landing/`.
- Closing heading `Ready for your next session?` with another `Continue with Google` button.

## How to get to it (user POV)

Open the site root while signed out. A signed-in visitor does not see this page; they see the journal. To see the landing while signed in, the app also mounts it at `/dev/landing`, where the sign-in buttons do nothing — that route is not this journey.

## Driving it with Chrome

Run `.cursor/skills/verify-surflog/scripts/drive-landing.mjs` after `launch.sh` and a passing `doctor.sh`. The script is the journey; do not drop steps.

1. `GET /` shows `<h1>` `Log it easy. Surf it better.`
2. Click the `中文` button (`aria-pressed`). The hero switches to `輕鬆記錄每次下水，陪你衝浪進步的好幫手`, `<html lang>` becomes `zh-TW`, and `localStorage["surflog:lang"]` is `zh-TW`.
3. Click `EN`. Hero and storage return to English.
4. Scroll to `<h2>` `Conditions fill themselves`. Body text includes `Jialeshui`.
5. Open `/spots`. Land on `/signin` with `Continue with Google` and a `callbackUrl`.
6. Return to `/` and click the header button `Sign in`. Leave Google's prompt alone if it appears. Then open `/api/auth/session` on this origin.

**End state.** `transcript.json` has `passed: true`. Screenshots show the English hero, the Chinese hero, the conditions section with `Jialeshui`, and the sign-in card. `localStorage["surflog:lang"]` is `en` again. `/api/auth/session` has no user id. No `sessions` row was written: the conditions card is demo copy (`components/landing/demo-data.ts`). That is the production behavior of this page, and it does not prove a save.

## Gotchas

- Section 04's live count is omitted when Supabase is unset or the `spots` read throws. The three mock cards still render. Do not fail the journey for a missing count, and do not pretend the count was checked.
- The board rack on this page is `inert`. Clicks that appear to work there are not the board journey (`features/boards.md`).
- Clicking `Sign in` or `Continue with Google` without `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` still leaves the origin: Auth.js redirects to `accounts.google.com` with `client_id=undefined`, and Google answers that the OAuth client was not found. With the credentials set, the same host shows the account chooser. Neither case is a completed login. Confirm by loading `/api/auth/session` back on this origin; it must be `null`. A fetch from the Google page is cross-origin and does not prove that. Record the host, not the query string, in `sign-in-observation.json`.
- `surflog:lang` sticks for the origin. A later test on the same profile will render Chinese until `EN` is clicked.
- `/dev/landing` skips the real server action. A green run there does not prove the sign-in button or the `/spots` redirect.
- The dev server log may show a hydration mismatch on `GrainyBackground` (`aria-hidden` / `className` differ between server and client). React regenerates that subtree. The journey still requires the hero text and the language click to change; the warning alone is not a failure and not a pass.
