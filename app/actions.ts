"use server";

import { signIn, signOut } from "@/auth";

export async function googleSignIn(callbackUrl?: string) {
  await signIn("google", { redirectTo: callbackUrl || "/" });
}

export async function googleSignOut() {
  await signOut({ redirectTo: "/signin" });
}
