/**
 * Optional sign-in allowlist: when SIGNIN_ALLOWED_EMAILS is set
 * (comma-separated Google account emails, case-insensitive; e.g.
 * "you@gmail.com,friend@gmail.com"), only those accounts may sign in.
 * Unset or empty = open to every Google account, which is production's
 * behaviour by design (CLAUDE.md "Multi-user"). It is meant for the staging
 * deployment, so set it in Vercel's Preview environment only. Note the
 * asymmetry with SPOT_ADMIN_EMAILS (unset = nobody): forgetting to set this
 * on staging leaves staging open.
 *
 * Checked at sign-in only (auth.ts). A session cookie issued before the list
 * changed stays valid until it expires.
 *
 * Pure and Edge-safe: auth.ts is imported by proxy.ts.
 */
export function signInAllowedEmails(): string[] {
  return (process.env.SIGNIN_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSignInAllowed(email: string | null | undefined): boolean {
  const allowed = signInAllowedEmails();
  if (allowed.length === 0) return true;
  const normalized = email?.trim().toLowerCase();
  return !!normalized && allowed.includes(normalized);
}
