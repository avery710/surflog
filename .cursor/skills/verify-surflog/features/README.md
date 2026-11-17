# Surflog feature map

Index of user-facing journeys for the `verify-surflog` skill. Each file is one journey. Drive it in Chrome using the steps in that file. If a precondition is missing, the journey fails and the reason is already in Gotchas — do not shrink the journey so the run goes green.

| Feature | File | Proved without Google + Supabase? |
|---|---|---|
| Signed-out landing | [landing.md](landing.md) | Yes. This is the journey `scripts/drive-landing.mjs` runs. |
| Log a session (notes, conditions, video) | [sessions.md](sessions.md) | No. Stops at `/signin`. |
| Spot catalogue | [spots.md](spots.md) | No. The redirect to `/signin` is the failure, not the goal. |
| Board rack | [boards.md](boards.md) | No. The landing rack is `inert` and does not count. |
| Share a session | [sharing.md](sharing.md) | No. Needs an owned session and the share dialog. |

`/dev/*` (see `app/dev/page.tsx`) mirrors several of these components with fixtures. It is a layout aid named in Gotchas, not a row in this table.
