/**
 * Polls clip_jobs and writes suggestion rows. Run with `npm run worker`
 * where ffmpeg and GEMINI_API_KEY are available. See worker/README.md.
 *
 * A job that was left `running` (the process died) is put back to
 * pending after 45 minutes so the next loop can take it. Unconfirmed
 * AI clips for that video are replaced, so a retry does not duplicate
 * them. Confirmed clips are left alone.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { insertClip, newClipId } from "../lib/clip-db";
import type { Clip } from "../lib/clips";
import { getSupabase } from "../lib/supabase";
import { suggestClips } from "./pipeline";
import { createTagger } from "./tagger";

const STALE_MS = 45 * 60 * 1000;
const POLL_MS = Number(process.env.WORKER_POLL_MS || 5000);

interface JobRow {
  id: string;
  owner_id: string;
  session_id: string;
  media_id: string;
  status: string;
}

function extFor(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  return "mp4";
}

async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const result = await getSupabase()
    .from("clip_jobs")
    .update({ status: "pending", started_at: null })
    .eq("status", "running")
    .lt("started_at", cutoff);
  if (result.error) throw new Error(result.error.message);
}

async function claimNext(): Promise<JobRow | null> {
  const sb = getSupabase();
  const pending = await sb
    .from("clip_jobs")
    .select("id, owner_id, session_id, media_id, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pending.error) throw new Error(pending.error.message);
  if (!pending.data) return null;
  const won = await sb
    .from("clip_jobs")
    .update({ status: "running", started_at: new Date().toISOString(), error: null })
    .eq("id", pending.data.id)
    .eq("status", "pending")
    .select("id, owner_id, session_id, media_id, status")
    .maybeSingle();
  if (won.error) throw new Error(won.error.message);
  return (won.data as JobRow | null) ?? null;
}

async function finish(id: string, status: "done" | "failed", error?: string): Promise<void> {
  const result = await getSupabase()
    .from("clip_jobs")
    .update({
      status,
      error: error ? error.slice(0, 500) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (result.error) throw new Error(result.error.message);
}

async function runJob(job: JobRow): Promise<void> {
  const sb = getSupabase();
  const meta = await sb.from("photo_blobs").select("mime_type").eq("id", job.media_id).maybeSingle();
  if (meta.error || !meta.data) throw new Error("source video is missing");
  const download = await sb.storage.from("photos").download(job.media_id);
  if (download.error || !download.data) throw new Error(download.error?.message ?? "could not download the video");

  const dir = await mkdtemp(`${tmpdir()}/surflog-clips-`);
  try {
    const source = `${dir}/source.${extFor(meta.data.mime_type as string)}`;
    await writeFile(source, Buffer.from(await download.data.arrayBuffer()));
    const tagger = createTagger();
    const drafts = await suggestClips({ sourcePath: source, workDir: dir, tagger });

    const cleared = await sb
      .from("clips")
      .delete()
      .eq("media_id", job.media_id)
      .eq("tagged_by", "ai")
      .eq("confirmed", false);
    if (cleared.error) throw new Error(cleared.error.message);

    for (const draft of drafts) {
      const clip: Clip = {
        id: newClipId(),
        ownerId: job.owner_id,
        sessionId: job.session_id,
        mediaId: job.media_id,
        startMs: draft.startMs,
        endMs: draft.endMs,
        skill: draft.skill,
        taggedBy: "ai",
        model: tagger.model,
        confidence: draft.confidence,
        confirmed: false,
        reaction: null,
        createdAt: new Date().toISOString(),
      };
      await insertClip(clip);
    }
    console.log(`[worker] ${job.id} wrote ${drafts.length} clip(s)`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function loop(stop: () => boolean): Promise<void> {
  for (;;) {
    if (stop()) return;
    await reclaimStale();
    const job = await claimNext();
    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    try {
      await runJob(job);
      await finish(job.id, "done");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[worker] ${job.id} failed: ${message}`);
      await finish(job.id, "failed", message);
    }
  }
}

function main(): void {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    console.error("ffmpeg is not on PATH. Install it before starting the worker.");
    process.exit(1);
  }
  try {
    createTagger();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  loop(() => stopping).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) main();
