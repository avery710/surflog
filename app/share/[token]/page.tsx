import { cache } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicShareView } from "@/components/share/public-share-view";
import { loadPublicShare } from "@/lib/session-share";
import { langFromAcceptLanguage } from "@/lib/share-lang";
import { clientIp, limitShareMiss } from "@/lib/share-limits";
import { shareT } from "@/lib/share-strings";

/**
 * The public page for a shared session. proxy.ts lets exactly /share/<token>
 * through without sign-in (and applies the per-IP request limit); the token
 * check is here. An unknown and a turned-off token are the same 404.
 * Rendered per request (it reads Accept-Language and the live share row),
 * never statically cached, so turning sharing off takes effect at once.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

// One lookup per request, shared by generateMetadata and the page.
const load = cache(async (token: string, acceptLanguage: string | null) =>
  loadPublicShare(token, langFromAcceptLanguage(acceptLanguage))
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const h = await headers();
  const share = await load(token, h.get("accept-language"));
  // Same neutral metadata for a missing share: nothing to confirm or deny.
  if (!share) return { title: "Surflog", robots: { index: false, follow: false } };

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = host ? `${proto}://${host}` : undefined;
  const t = (k: Parameters<typeof shareT>[1], v?: Record<string, string | number>) => shareT(share.lang, k, v);

  const date = share.whenLabel.split(" · ")[0];
  const vars = { spot: share.spotName, date, name: share.owner.name ?? "" };
  const title = t("share.page.title", vars);
  const description = share.owner.name ? t("share.page.description", vars) : t("share.page.descriptionAnon", vars);
  const image = `/share/${token}/card.png?v=og&lang=${share.lang}`;

  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title,
    description,
    // The link carries the secret; never send it on to other sites.
    referrer: "no-referrer",
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      type: "article",
      siteName: "Surflog",
      title,
      description,
      locale: share.lang === "zh-TW" ? "zh_TW" : "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedSessionPage({ params }: Props) {
  const { token } = await params;
  const h = await headers();
  const share = await load(token, h.get("accept-language"));
  if (!share) {
    limitShareMiss(clientIp(h));
    notFound();
  }
  return <PublicShareView share={share} mediaBase={`/api/share/${token}/media`} />;
}
