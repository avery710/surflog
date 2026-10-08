/**
 * Pure helpers behind the share dialog's destination buttons. No DOM access:
 * the caller passes in what it detected, so the decisions are unit-testable.
 *
 * What a web page can and can't do (see the share dialog's header comment):
 * - Files reach other apps only through the OS share sheet (Web Share API)
 *   or the clipboard. There is no web way to hand an image to WhatsApp / LINE.
 * - Their URL schemes and web intents carry TEXT or a LINK only, so the dialog
 *   doesn't use them: "More" sends image + text + link through the share sheet.
 * - Instagram Stories accept images from native apps only (pasteboard +
 *   `instagram-stories://share`). The web's best effort is: put the image on
 *   the clipboard, open the story camera, let the user tap "Add sticker".
 */

export type MobileOS = "ios" | "android";

/** iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen is an iPad. */
export function detectMobileOS(userAgent: string, maxTouchPoints: number): MobileOS | null {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return null;
}

/** Opens Instagram's story camera (iOS and Android). Not a public API: it can stop working. */
export const INSTAGRAM_STORY_URL = "instagram://story-camera";

/** The story hand-off needs a phone AND a clipboard that takes images. */
export function canInstagramStory(os: MobileOS | null, clipboardImage: boolean): boolean {
  return os !== null && clipboardImage;
}

/**
 * What the "More" button hands to navigator.share: the image together with the
 * invite text and the link, so a chat app (WhatsApp, LINE, Messages, …) gets
 * all three in one message. Browsers and target apps differ in what they take
 * with a file, so this steps down until `canShare` accepts: image + text + link,
 * image + text, image alone, then text + link without the image. Null = nothing
 * shareable (the button is hidden).
 */
export function sharePayload(input: {
  hasShare: boolean;
  file: File | null;
  text: string;
  url: string;
  canShare: (data: ShareData) => boolean;
}): ShareData | null {
  if (!input.hasShare) return null;
  const { file, text, url, canShare } = input;
  const tries: ShareData[] = file
    ? [{ files: [file], text, url }, { files: [file], text: `${text} ${url}` }, { files: [file] }, { text, url }]
    : [{ text, url }];
  return tries.find((d) => canShare(d)) ?? null;
}
