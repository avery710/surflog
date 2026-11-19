/** Byte caps shared by the browser uploader and the server check.
 *  Kept out of lib/blob.ts so a client component can import them without
 *  pulling in the service-role Supabase client. */

/** Images and short clips. Supabase Storage on this project was measured
 *  at 50 MB (2026-10-05). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** A whole session video. The app allows 1 GB; Supabase's project limit
 *  is separate and still 50 MB until it's raised in the dashboard. */
export const MAX_SESSION_VIDEO_BYTES = 1024 * 1024 * 1024;
