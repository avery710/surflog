# Clip worker

Suggests skill clips for a session video. It is a separate process, not a
Vercel function: a long video would time out there. The site only inserts
a row in `clip_jobs` when a session video is saved. This process polls
that table.

## What it does

1. Claim one `pending` job.
2. Download the video from the `photos` bucket.
3. ffmpeg: a ~1 fps, 480 px-wide proxy. Gemini 2.5 Flash returns rides as
   JSON `{ startSec, endSec }`.
4. ffmpeg cuts each ride at ~5 fps. A second call returns skill segments
   with a confidence.
5. Write `clips` rows: `tagged_by = ai`, `confirmed = false`, model name
   and confidence set. The review screen (`/sessions/<id>/clips`) is the
   same one used by hand. Reload it, or tap “Check for suggestions”.

`TAGGER` selects the model. Only `gemini` is built. Another model is a
new file behind `worker/tagger.ts` plus that env value.

A job left `running` for 45 minutes (the process died) goes back to
`pending`. A retry deletes unconfirmed AI clips for that video first.
Confirmed clips stay.

## Run locally

Needs ffmpeg on `PATH`, and the same Supabase vars as the app
(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`) plus `GEMINI_API_KEY`.

```
ffmpeg -version
# .env.local already has the Supabase vars. Add:
#   GEMINI_API_KEY=...
set -a && source .env.local && set +a
npm run worker
```

Optional: `GEMINI_MODEL` (default `gemini-2.5-flash`), `TAGGER` (default
`gemini`), `WORKER_POLL_MS` (default 5000).

Apply both migrations first: `20261119000000_create_clips.sql` and
`20261119010000_create_clip_jobs.sql`. A deploy to staging applies them.

## Deploy

Any container host. From the repo root:

```
docker build -f worker/Dockerfile -t surflog-worker .
docker run --rm --env-file .env.local surflog-worker
```

The image is Node 22 plus ffmpeg. It does not bake in secrets; pass
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `GEMINI_API_KEY` at run time.
One replica is enough. Two are safe: a job is claimed with a conditional
update, and only one open job is allowed per video.

Do not put `GEMINI_API_KEY` in the Next.js / Vercel env. The site never
reads it.
