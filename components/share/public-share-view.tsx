import { SharedEntryCard } from "@/components/share/shared-entry-card";
import { PAGE_COLUMN } from "@/lib/layout";
import type { PublicShare } from "@/lib/share-public";
import { shareT } from "@/lib/share-strings";

/**
 * The public /share/<token> page body. A server component with no hooks and no
 * client provider: it renders only the whitelisted PublicShare, in the
 * language that object carries (lib/share-strings.ts), so a visitor with no
 * app state sees it the way the owner set it up. The card is the journal's
 * own EntryCard (read-only), fed `share.card`: a Session rebuilt from public
 * fields only (lib/share-public.ts), never the stored row.
 */
export function PublicShareView({
  share,
  mediaBase,
  homeHref = "/",
  signedIn = false,
}: {
  share: PublicShare;
  /** `/api/share/<token>/media` — omitted on the dev showcase, which has no media. */
  mediaBase?: string;
  homeHref?: string;
  /** The visitor already has a Surflog session: "Open my journal" instead of
   *  Sign in / Sign up free. Both of those go to Google sign-in, then the journal. */
  signedIn?: boolean;
}) {
  const { lang } = share;
  const t = (k: Parameters<typeof shareT>[1], v?: Record<string, string | number>) => shareT(lang, k, v);

  const signInHref = `/signin?callbackUrl=${encodeURIComponent(homeHref)}`;
  const pill =
    "rounded-full bg-card px-4 py-2 text-[13.5px] font-semibold text-primary outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-white";

  return (
    <div lang={lang} className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-primary">
        <div className={`${PAGE_COLUMN} flex items-center justify-between py-3`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/surflog-logo.png" alt="Surflog" className="h-5 w-auto brightness-0 invert" />
          {signedIn ? (
            <a href={homeHref} className={pill}>
              {t("share.page.openJournal")}
            </a>
          ) : (
            <div className="flex items-center gap-2.5">
              <a
                href={signInHref}
                className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"
              >
                {t("share.page.signIn")}
              </a>
              <a href={signInHref} className={pill}>
                {t("share.page.signUp")}
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Same column as the journal (PAGE_COLUMN); a flex column so the call to
          action sits at the bottom of the screen even under a short session. */}
      <main className={`${PAGE_COLUMN} flex flex-1 flex-col pt-6 pb-10`}>
        <h1 className="sr-only">{share.spotName}</h1>
        {/* The session card itself, the same component as the journal's,
            borderless here, with "Surfed by …" under the spot name. */}
        <SharedEntryCard
          card={share.card}
          lang={lang}
          mediaBase={mediaBase}
          byline={
            share.owner.name ? (
              <span className="flex items-center gap-2 text-[13.5px] text-muted-foreground">
                {share.owner.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={share.owner.image}
                    alt=""
                    width={24}
                    height={24}
                    referrerPolicy="no-referrer"
                    className="size-6 rounded-full object-cover"
                  />
                )}
                <span>{t("share.page.by", { name: share.owner.name })}</span>
              </span>
            ) : undefined
          }
        />

        <div className="mt-auto pt-10">
          <section className="rounded-[var(--r-card)] border border-card-border bg-card px-6 py-5 text-center">
            <p className="text-[15px] font-semibold">{t("share.page.cta")}</p>
            <a
              href={signedIn ? homeHref : signInHref}
              className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t(signedIn ? "share.page.openJournal" : "share.page.signUp")}
            </a>
          </section>
          <p className="mt-4 text-center text-[12px] text-muted-foreground">{t("share.page.footer")}</p>
        </div>
      </main>
    </div>
  );
}
