import type { PublicShare } from "@/lib/share-public";
import { shareT } from "@/lib/share-strings";

/**
 * The public /s/<token> page body. A server component with no hooks and no
 * client provider: it renders only the whitelisted PublicShare, in the
 * language that object carries (lib/share-strings.ts), so a visitor with no
 * app state sees it the way the owner set it up. The card look follows the
 * session card (white card, grey tiles, mono figures) without importing it:
 * EntryCard takes a full Session, which must never be sent to a stranger.
 */
export function PublicShareView({
  share,
  mediaBase,
  homeHref = "/",
}: {
  share: PublicShare;
  /** `/api/share/<token>/media` — omitted on the dev showcase, which has no media. */
  mediaBase?: string;
  homeHref?: string;
}) {
  const { lang } = share;
  const t = (k: Parameters<typeof shareT>[1], v?: Record<string, string | number>) => shareT(lang, k, v);

  return (
    <div lang={lang} className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="bg-primary">
        <div className="mx-auto flex max-w-[680px] items-center justify-between px-4.5 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/surflog-logo.svg" alt="Surflog" className="h-7 w-auto" />
          <a
            href={homeHref}
            className="rounded-full bg-card px-4 py-2 text-[13.5px] font-semibold text-primary outline-none hover:brightness-95 focus-visible:ring-2 focus-visible:ring-white"
          >
            {t("share.page.open")}
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[680px] flex-1 px-4.5 pt-6 pb-10">
        <article className="overflow-hidden rounded-[var(--r-card)] border border-card-border bg-card">
          <div className="px-6 pt-5 pb-2">
            <h1 className="text-[24px] leading-tight font-bold tracking-[-0.02em] break-words">{share.spotName}</h1>
            <p className="mt-1 text-[13.5px] font-medium tabular-nums">{share.whenLabel}</p>
            {share.owner.name && (
              <p className="mt-3 flex items-center gap-2 text-[13.5px] text-muted-foreground">
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
              </p>
            )}
          </div>

          {share.tiles.length > 0 && (
            <section aria-label={t("share.page.conditions")} className="grid grid-cols-2 gap-2 px-6 pt-2 pb-1.5 sm:grid-cols-3">
              {share.tiles.map((tile) => (
                <div key={tile.key} className="min-w-0 rounded-[var(--r-tile)] bg-secondary px-3 py-2.5">
                  <span className="mb-0.5 block text-[11px] font-semibold tracking-[0.01em] text-[var(--faint)]">
                    {tile.label}
                  </span>
                  <span className="flex min-h-5 items-baseline font-mono text-[16px] leading-5 font-medium tracking-[-0.02em] whitespace-nowrap tabular-nums">
                    {tile.value}
                    {tile.unit ? <span className="ml-0.5 font-sans text-[10px] font-normal text-muted-foreground">{tile.unit}</span> : null}
                  </span>
                  {tile.lines.map((line, i) => (
                    <span key={i} className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                      {line}
                    </span>
                  ))}
                </div>
              ))}
            </section>
          )}

          {share.boardName && (
            <p className="px-6 pt-3 text-[13.5px]">
              <span className="text-muted-foreground">{t("share.board")}</span>{" "}
              <span className="font-medium">{share.boardName}</span>
            </p>
          )}

          {share.notesHtml && (
            <div
              className="notes-html px-6 pt-3 pb-2.5 font-sans text-[15px] leading-[1.6] text-foreground"
              // sanitizeNotesHtml() output: only p/br/div/u/ul/ol/li/b/i, no attributes
              dangerouslySetInnerHTML={{ __html: share.notesHtml }}
            />
          )}

          {mediaBase && share.media.length > 0 && (
            <div className="flex flex-col gap-2.5 px-6 pt-2 pb-2">
              {share.media.map((m) =>
                m.type.startsWith("video/") ? (
                  <video
                    key={m.id}
                    src={`${mediaBase}/${m.id}`}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[70vh] w-full rounded-[var(--r-tile)] bg-black"
                  />
                ) : (
                  <a key={m.id} href={`${mediaBase}/${m.id}`} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${mediaBase}/${m.id}`}
                      alt={t("share.page.photoAlt")}
                      loading="lazy"
                      className="max-h-[80vh] w-full rounded-[var(--r-tile)] object-contain"
                    />
                  </a>
                )
              )}
            </div>
          )}
          <div className="h-4" />
        </article>

        <section className="mt-6 rounded-[var(--r-card)] border border-card-border bg-card px-6 py-5 text-center">
          <p className="text-[15px] font-semibold">{t("share.page.cta")}</p>
          <a
            href={homeHref}
            className="mt-3 inline-block rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-primary-foreground outline-none hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t("share.page.open")}
          </a>
        </section>
        <p className="mt-4 text-center text-[12px] text-muted-foreground">{t("share.page.footer")}</p>
      </main>
    </div>
  );
}
