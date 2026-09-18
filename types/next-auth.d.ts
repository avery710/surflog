import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Google's stable OIDC subject id — used as Session.ownerId in lib/db.ts */
      id: string;
    } & DefaultSession["user"];
  }
}
