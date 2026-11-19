/**
 * Two passes. Pass 1 finds rides on a 1 fps proxy of the whole video.
 * Pass 2 labels skills on a 5 fps cut of each ride. Segment times come
 * back relative to that cut; clipsFromRide puts them on the full video.
 * At most MAX_RIDES rides, so a bad response cannot launch hundreds of
 * ffmpeg runs.
 */
import { clipsFromRide, type DraftClip } from "./parse";
import type { Tagger } from "./tagger";
import { ffmpegTranscode, type TranscodeRequest } from "./ffmpeg";

export const MAX_RIDES = 40;
const PASS1_FPS = 1;
const PASS2_FPS = 5;

export async function suggestClips(args: {
  sourcePath: string;
  workDir: string;
  tagger: Tagger;
  transcode?: (req: TranscodeRequest) => Promise<void>;
}): Promise<DraftClip[]> {
  const transcode = args.transcode ?? ffmpegTranscode;
  const proxy = `${args.workDir}/pass1.mp4`;
  await transcode({ input: args.sourcePath, output: proxy, fps: PASS1_FPS, width: 480 });
  const rides = (await args.tagger.findRides({ path: proxy, mimeType: "video/mp4" })).slice(0, MAX_RIDES);

  const clips: DraftClip[] = [];
  for (let i = 0; i < rides.length; i++) {
    const ride = rides[i];
    const cut = `${args.workDir}/ride-${i}.mp4`;
    await transcode({
      input: args.sourcePath,
      output: cut,
      fps: PASS2_FPS,
      width: 640,
      startSec: ride.startSec,
      endSec: ride.endSec,
    });
    const segments = await args.tagger.labelRide({ path: cut, mimeType: "video/mp4" });
    clips.push(...clipsFromRide(ride, segments));
  }
  return clips;
}
