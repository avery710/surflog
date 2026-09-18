# data/

**No longer used by the app** as of 2026-09-18 — `lib/db.ts` and
`lib/blob.ts` now talk to Supabase (Postgres + Storage), not this
directory. See `supabase/migrations/` for the schema and the top of
`lib/db.ts` / `lib/blob.ts` for how.

- `sessions.json` — the pre-Supabase journal file. Kept locally only as a
  backup of what got migrated (see the 3 rows with `owner_id: "legacy"` in
  the `sessions` table); not read by anything anymore. Safe to delete once
  you're confident the migration is solid, but there's no rush — it's
  gitignored either way.
- `blobs/` — same story, for photos; superseded by the Storage bucket
  `photos`.
