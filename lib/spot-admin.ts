/**
 * Who may create, edit or delete shared spots: only the accounts listed in
 * the SPOT_ADMIN_EMAILS env var (comma-separated Google account emails,
 * case-insensitive; e.g. "you@gmail.com" or "a@gmail.com,b@gmail.com").
 * Unset or empty = nobody, so a missing var fails closed. Reading the
 * catalogue stays open to every signed-in user.
 *
 * Server-side only. The client only ever learns a boolean (`canManageSpots`,
 * passed from app/page.tsx); the list itself never leaves the server.
 */
export function isSpotAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  const admins = (process.env.SPOT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email);
}
