import Link from "next/link";
import { notFound } from "next/navigation";
import { OAuthConsent, type ConsentRequest } from "@/components/oauth-consent";
import { LangSwitch } from "../signin-preview/lang-switch";

/**
 * DEV-ONLY preview of the AI app consent screen (/oauth/authorize) so it can be
 * checked without a real connection from an AI app. 404s in production builds.
 * Allow / Deny do nothing here: no code is minted, nothing redirects.
 *
 * /dev/oauth-consent                → Claude asking, "Read and write" picked
 * /dev/oauth-consent?case=read      → an app whose default is read-only
 * /dev/oauth-consent?case=invalid   → the bad-link message
 */

const BASE: Omit<ConsentRequest, "clientName" | "redirectHost" | "defaultScope"> = {
  clientId: "dev-client",
  redirectUri: "https://example.invalid/callback",
  codeChallenge: "dev",
  state: "dev",
};

const CASES: { key: string; label: string; request: ConsentRequest | null }[] = [
  {
    key: "write",
    label: "Claude, read and write",
    request: { ...BASE, clientName: "Claude", redirectHost: "claude.ai", defaultScope: "write" },
  },
  {
    key: "read",
    label: "ChatGPT, read only",
    request: { ...BASE, clientName: "ChatGPT", redirectHost: "chatgpt.com", defaultScope: "read" },
  },
  { key: "invalid", label: "Invalid link", request: null },
];

export default async function OAuthConsentPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { case: key } = await searchParams;
  const current = CASES.find((c) => c.key === key) ?? CASES[0];

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-4.5 py-8">
      <LangSwitch />
      <nav className="flex flex-wrap justify-center gap-1.5 text-xs font-semibold">
        {CASES.map((c) => (
          <Link
            key={c.key}
            href={`?case=${c.key}`}
            className={
              "rounded-full px-3 py-1 " +
              (c === current ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")
            }
          >
            {c.label}
          </Link>
        ))}
      </nav>
      {/* key: remount so the picked scope follows the case's default */}
      <OAuthConsent
        key={current.key}
        request={current.request}
        action={async () => {
          "use server";
        }}
      />
    </div>
  );
}
