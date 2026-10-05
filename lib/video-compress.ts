/**
 * Browser-side video compression, so a phone clip fits Supabase Storage's
 * 50 MB per-file ceiling (measured 2026-10-05: 45 MB accepted, 55 MB
 * refused). Re-encodes to H.264 MP4 with WebCodecs through mediabunny,
 * which is loaded only when a video actually needs it.
 *
 * Anything that goes wrong — no WebCodecs, an unreadable file, an encoder
 * the browser lacks — returns the original file untouched; the caller's
 * size check then decides whether it can still go up.
 */

/** A clip already this small is sent as it is. */
const KEEP_AS_IS_BYTES = 16 * 1024 * 1024;
/** What a compressed clip should come out at or under — headroom below 50 MB. */
const TARGET_BYTES = 45 * 1024 * 1024;
const AUDIO_BITRATE = 128_000;
/** Preferred picture: 1080p at 5 Mbit/s. A clip too long for that at
 *  TARGET_BYTES steps down to 720p, and its bitrate shrinks to fit, but
 *  never below the floor — under that the picture isn't worth keeping. */
const FULL = { edge: 1920, bitrate: 5_000_000, minBitrate: 4_000_000 };
const SMALL = { edge: 1280, bitrate: 2_800_000, minBitrate: 1_500_000 };

export class VideoTooLongError extends Error {}

/**
 * Returns a smaller MP4 when that helps, else the original file.
 * `onProgress` gets 0..1 while encoding. Throws VideoTooLongError when even
 * 720p at the bitrate floor would exceed the target size (roughly 4 minutes).
 */
export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<File> {
  if (!file.type.startsWith("video/") || file.size <= KEEP_AS_IS_BYTES) return file;
  if (typeof VideoEncoder === "undefined" || typeof VideoDecoder === "undefined") return file;

  let tooLong = false;
  try {
    const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality } =
      await import("mediabunny");

    const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    const duration = await input.computeDuration();
    if (!track || !(duration > 0)) return file;

    const budget = (TARGET_BYTES * 8) / duration - AUDIO_BITRATE;
    const plan = budget >= FULL.minBitrate ? FULL : budget >= SMALL.minBitrate ? SMALL : null;
    if (!plan) {
      tooLong = true;
      throw new VideoTooLongError();
    }
    const bitrate = Math.round(Math.min(plan.bitrate, budget));

    const [width, height] = [await track.getDisplayWidth(), await track.getDisplayHeight()];
    const longest = Math.max(width, height);
    // Already within the plan's size and bitrate: re-encoding would only cost quality.
    if (longest <= plan.edge && (file.size * 8) / duration <= bitrate * 1.1) return file;

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
    const edge = Math.min(longest, plan.edge);
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: {
        ...(width >= height ? { width: edge } : { height: edge }),
        codec: "avc",
        quality: new Quality({ bitrate, bitrateMode: "constant" }),
        forceTranscode: true,
      },
      showWarnings: false,
    });
    if (!conversion.isValid) {
      console.warn("[video-compress] nothing to convert:", conversion.discardedTracks);
      return file;
    }
    conversion.onProgress = (p) => onProgress?.(p);
    await conversion.execute();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength >= file.size) return file;
    return new File([buffer], file.name.replace(/\.[^.]+$/, "") + ".mp4", { type: "video/mp4" });
  } catch (e) {
    if (tooLong) throw e;
    // not fatal, but worth seeing: which browsers/files can't be compressed
    console.warn("[video-compress] sending the original instead:", e);
    return file;
  }
}
