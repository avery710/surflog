/**
 * Shells out to ffmpeg. Pass 1 is the whole video at ~1 fps. Pass 2 is
 * one ride at ~5 fps. Audio is dropped. The worker checks ffmpeg is on
 * PATH before it takes a job.
 */
import { spawn } from "node:child_process";

export interface TranscodeRequest {
  input: string;
  output: string;
  fps: number;
  width: number;
  /** Set for a ride cut. Seconds on the source video. */
  startSec?: number;
  endSec?: number;
}

export function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err = (err + chunk.toString()).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.trim()}`));
    });
  });
}

/** Even height (-2) so libx264 accepts a portrait phone video. */
export function ffmpegTranscode(req: TranscodeRequest): Promise<void> {
  const trim =
    req.startSec != null && req.endSec != null
      ? ["-ss", req.startSec.toFixed(3), "-to", req.endSec.toFixed(3)]
      : [];
  return ffmpeg([
    "-y",
    "-i",
    req.input,
    ...trim,
    "-an",
    "-vf",
    `fps=${req.fps},scale=${req.width}:-2`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "32",
    "-movflags",
    "+faststart",
    req.output,
  ]);
}
