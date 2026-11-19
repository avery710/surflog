/**
 * Gemini over the public generateContent API. The model id comes from
 * GEMINI_MODEL (default gemini-3.8-flash) and is the string stored on
 * each clip row. Video goes up through the File API (a whole session
 * can exceed the inline limit), then the file is deleted. The key stays
 * in the request URL and is never logged.
 *
 * Frame rate is not set here. The current video-understanding page
 * documents per-request fps as `processing.fps` on the Interactions API,
 * not as videoMetadata on generateContent, and it says a File API upload
 * is stored at 1 fps. Sampling stays in ffmpeg (1 fps for rides, 5 fps
 * for a ride clip) so the rate is the one we asked for.
 */
import { readFile } from "node:fs/promises";
import { RIDE_PROMPT, SKILL_PROMPT } from "./prompts";
import { parseRides, parseSkills, type RideSpan, type SkillSpan } from "./parse";
import type { Tagger, VideoFile } from "./tagger";

const HOST = "https://generativelanguage.googleapis.com";

export function textFromGenerateResponse(body: unknown): string {
  const candidates = (body as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates;
  const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("model returned no text");
  return text;
}

export class GeminiTagger implements Tagger {
  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  findRides(video: VideoFile): Promise<RideSpan[]> {
    return this.ask(video, RIDE_PROMPT).then(parseRides);
  }

  labelRide(video: VideoFile): Promise<SkillSpan[]> {
    return this.ask(video, SKILL_PROMPT).then(parseSkills);
  }

  private async ask(video: VideoFile, prompt: string): Promise<string> {
    const uploaded = await uploadVideo(this.apiKey, video);
    try {
      const res = await fetch(
        `${HOST}/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { file_data: { mime_type: uploaded.mimeType, file_uri: uploaded.uri } },
                  { text: prompt },
                ],
              },
            ],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const message = (json as { error?: { message?: string } })?.error?.message ?? res.statusText;
        throw new Error(`Gemini ${res.status}: ${message}`);
      }
      return textFromGenerateResponse(json);
    } finally {
      await deleteFile(this.apiKey, uploaded.name).catch(() => undefined);
    }
  }
}

interface Uploaded {
  name: string;
  uri: string;
  mimeType: string;
}

async function uploadVideo(apiKey: string, video: VideoFile): Promise<Uploaded> {
  const bytes = await readFile(video.path);
  const start = await fetch(`${HOST}/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": video.mimeType,
    },
    body: JSON.stringify({ file: { display_name: "surflog-clip" } }),
  });
  if (!start.ok) throw new Error(`Gemini upload start ${start.status}`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload did not return a URL");

  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(bytes),
  });
  const created = await put.json().catch(() => null);
  if (!put.ok) throw new Error(`Gemini upload ${put.status}`);
  const file = (created as { file?: { name?: string; uri?: string; mimeType?: string; state?: string } })?.file;
  if (!file?.name || !file.uri) throw new Error("Gemini upload returned no file");
  const ready = await waitUntilActive(apiKey, file.name, file.state);
  return { name: file.name, uri: file.uri, mimeType: ready.mimeType || file.mimeType || video.mimeType };
}

async function waitUntilActive(
  apiKey: string,
  name: string,
  state: string | undefined
): Promise<{ mimeType?: string }> {
  let current = state;
  for (let i = 0; i < 30 && current && current !== "ACTIVE"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${HOST}/v1beta/${name}?key=${encodeURIComponent(apiKey)}`);
    const json = (await res.json().catch(() => null)) as { state?: string; mimeType?: string; error?: { message?: string } } | null;
    if (!res.ok) throw new Error(json?.error?.message ?? `Gemini file ${res.status}`);
    current = json?.state;
    if (current === "FAILED") throw new Error("Gemini could not read that video");
    if (current === "ACTIVE") return { mimeType: json?.mimeType };
  }
  if (current && current !== "ACTIVE") throw new Error("Gemini file was not ready");
  return {};
}

async function deleteFile(apiKey: string, name: string): Promise<void> {
  await fetch(`${HOST}/v1beta/${name}?key=${encodeURIComponent(apiKey)}`, { method: "DELETE" });
}
