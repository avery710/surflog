import Link from "next/link";
import { notFound } from "next/navigation";
import { SignInCard } from "@/components/signin-card";
import { LangSwitch } from "./lang-switch";

/**
 * DEV-ONLY preview of the signed-out page (/signin) so it can be checked
 * without signing out. 404s in production builds. The button does nothing
 * here — it doesn't start a Google sign-in.
 *
 * /dev/signin-preview                           → the page as a new visitor sees it
 * /dev/signin-preview?error=AccessDenied        → with an error banner
 * (also OAuthAccountNotLinked, or anything else → the generic error)
 */

const VARIANTS = [
  { label: "No error", error: undefined },
  { label: "AccessDenied", error: "AccessDenied" },
  { label: "OAuthAccountNotLinked", error: "OAuthAccountNotLinked" },
  { label: "Other error", error: "Configuration" },
];

export default async function SignInPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4.5">
      <LangSwitch />
      <nav className="flex flex-wrap justify-center gap-1.5 text-xs font-semibold">
        {VARIANTS.map((v) => {
          const active = v.error === error;
          return (
            <Link
              key={v.label}
              href={v.error ? `?error=${v.error}` : "?"}
              className={
                "rounded-full px-3 py-1 " +
                (active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")
              }
            >
              {v.label}
            </Link>
          );
        })}
      </nav>
      <SignInCard
        error={error}
        action={async () => {
          "use server";
        }}
      />
    </div>
  );
}
