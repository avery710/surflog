/**
 * Auth.js (next-auth v5) config — Google sign-in only.
 *
 * Multi-user as of 2026-09-18: anyone with a Google account can sign in
 * (there's no invite list/domain restriction — see CLAUDE.md "Multi-user").
 * What Google auth actually buys us is identity, not gatekeeping: every
 * session row gets tagged with the signer's stable Google subject id
 * (`token.sub`) as `ownerId`, and every read/write in the API routes is
 * scoped to that id. Nobody sees anybody else's journal.
 *
 * JWT session strategy, no database adapter — consistent with lib/db.ts
 * being a JSON file for now. This file is imported by middleware.ts, which
 * runs on the Edge runtime, so keep it free of Node-only imports (no `fs`,
 * no lib/db.ts).
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in; Google's provider
      // profile maps `id` to the OIDC `sub` claim, which NextAuth already
      // uses as `token.sub` — this just makes that explicit.
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
