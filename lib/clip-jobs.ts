/**
 * Queue a session video for the clip worker. The web app never runs the
 * model. A missing table is JobsNotReady so attaching the video still
 * succeeds before this migration is applied.
 */
import { isMissingTable } from "./spot-store";
import { getSupabase } from "./supabase";

export class JobsNotReady extends Error {
  constructor() {
    super("clip jobs aren't switched on yet — the 20261119010000 migration hasn't been applied");
  }
}

function raise(error: { message: string; code?: string }): never {
  if (isMissingTable(error)) throw new JobsNotReady();
  throw new Error(`Supabase: ${error.message}`);
}

export async function enqueueClipJob(job: {
  ownerId: string;
  sessionId: string;
  mediaId: string;
}): Promise<void> {
  const sb = getSupabase();
  const open = await sb
    .from("clip_jobs")
    .select("id")
    .eq("media_id", job.mediaId)
    .in("status", ["pending", "running"])
    .maybeSingle();
  if (open.error) raise(open.error);
  if (open.data) return;

  const insert = await sb.from("clip_jobs").insert({
    id: crypto.randomUUID().replace(/-/g, ""),
    owner_id: job.ownerId,
    session_id: job.sessionId,
    media_id: job.mediaId,
    status: "pending",
  });
  if (insert.error) {
    if (insert.error.code === "23505") return;
    raise(insert.error);
  }
}
