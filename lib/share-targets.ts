/**
 * Pure helpers behind the share dialog's destination buttons. No DOM access:
 * the caller passes in what it detected, so the decisions are unit-testable.
 *
 * What a web page can and can't do (see the share dialog's header comment):
 * - Files reach other apps only through the OS share sheet (Web Share API)
 *   or the clipboard. There is no web way to hand an image to WhatsApp / LINE.
 * - Their URL schemes and web intents carry TEXT or a LINK only.
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

export function whatsappUrl(link: string, text?: string): string {
  const body = text ? `${text} ${link}` : link;
  return `https://wa.me/?text=${encodeURIComponent(body)}`;
}

export function lineUrl(link: string, text?: string): string {
  const body = text ? `${text}\n${link}` : link;
  return `https://line.me/R/msg/text/?${encodeURIComponent(body)}`;
}

export type MoreShareKind = "file" | "link" | null;

/**
 * What the "More" button hands to navigator.share: the image when the browser
 * accepts it as a file, else the public link when it is on, else nothing
 * (button hidden).
 */
export function moreShareKind(input: { hasShare: boolean; canShareFile: boolean; link: string | null }): MoreShareKind {
  if (!input.hasShare) return null;
  if (input.canShareFile) return "file";
  if (input.link) return "link";
  return null;
}
