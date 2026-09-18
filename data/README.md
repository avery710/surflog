# data/

Runtime storage for local dev — see `lib/db.ts` / `lib/blob.ts`.

- `sessions.json` — the journal itself. **Not committed** (real personal
  entries live here locally only — decided 2026-09-18, when this repo went
  public). Missing entirely is fine: the app creates it on the first save,
  starting empty.
- `blobs/` — uploaded photo/video files. Also not committed, same reason.

Neither of these is meant to survive a Vercel deploy as-is — see README.md
"Before deploying to Vercel".
