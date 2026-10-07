"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";

export interface ConsentRequest {
  clientName: string;
  redirectHost: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  defaultScope: "read" | "write";
}

/** The consent card for /oauth/authorize. `request` is null when the link was
 *  malformed or its client / redirect URI unknown — we show an error, never
 *  redirect to an address we can't vouch for. */
export function OAuthConsent({
  request,
  action,
}: {
  request: ConsentRequest | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const { t } = useLang();
  const [scope, setScope] = useState<"read" | "write">(request?.defaultScope ?? "write");

  return (
    <div className="w-full max-w-[400px] rounded-[var(--r-card)] border border-card-border bg-card p-8">
      <h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/surflog-logo.png" alt="Surflog" width={1200} height={228} className="block h-6 w-auto" />
      </h1>

      {!request ? (
        <p className="mt-5 rounded-[var(--r-tile)] bg-[var(--warm-soft)] px-4 py-3 text-[13.5px] font-medium text-warm">
          {t("oauth.invalid")}
        </p>
      ) : (
        <form action={action} className="mt-5">
          <input type="hidden" name="client_id" value={request.clientId} />
          <input type="hidden" name="redirect_uri" value={request.redirectUri} />
          <input type="hidden" name="code_challenge" value={request.codeChallenge} />
          <input type="hidden" name="state" value={request.state} />

          <h2 className="font-sans text-xl font-extrabold">{t("oauth.title", { name: request.clientName })}</h2>
          <p className="mt-2 text-[13.5px] text-muted-foreground">{t("oauth.intro")}</p>

          <fieldset className="mt-5 flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-semibold text-muted-foreground">{t("tokens.scopeLabel")}</legend>
            {(["write", "read"] as const).map((s) => (
              <label
                key={s}
                className={`flex cursor-pointer items-start gap-3 rounded-[var(--r-tile)] border p-3 ${
                  scope === s ? "border-primary" : "border-card-border"
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value={s}
                  checked={scope === s}
                  onChange={() => setScope(s)}
                  className="mt-1 accent-[var(--primary)]"
                />
                <span>
                  <span className="block text-[14px] font-bold">
                    {s === "write" ? t("tokens.scopeWrite") : t("tokens.scopeRead")}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {s === "write" ? t("oauth.writeHelp") : t("oauth.readHelp")}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <p className="mt-4 text-[12.5px] text-muted-foreground">{t("oauth.redirectNote", { host: request.redirectHost })}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">{t("oauth.revokeNote")}</p>

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              name="decision"
              value="approve"
              className="flex-1 rounded-full bg-primary px-5 py-2.5 font-sans text-[14.5px] font-bold text-primary-foreground transition-[filter] hover:brightness-110 active:scale-[0.975]"
            >
              {t("oauth.allow")}
            </button>
            <button
              type="submit"
              name="decision"
              value="deny"
              className="flex-1 rounded-full bg-secondary px-5 py-2.5 font-sans text-[14.5px] font-bold transition-[filter] hover:brightness-95 active:scale-[0.975]"
            >
              {t("oauth.deny")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
