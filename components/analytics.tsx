"use client";

import { useSyncExternalStore } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { scrubAnalyticsUrl } from "@/lib/analytics-url";
import { useLang } from "@/lib/i18n";

/**
 * Vercel Web Analytics (SURFLOG-33): cookieless page views, visitor counts
 * and country. No user is identified and no custom events carry user data.
 * Client component because `beforeSend` is a function. Only active on Vercel
 * deployments (it does nothing under `next dev`).
 *
 * Language: Web Analytics has no language dimension, but its script reads
 * `data-flag-values` tags on every page view and attaches them (flags work on
 * Hobby; custom events don't). So the tag below reports `lang`, the app's
 * language setting, and `browserLang`, the browser's own; break down by
 * `flags/lang` in the dashboard. Must sit inside LanguageProvider.
 */
export function Analytics() {
  const { lang } = useLang();
  const browserLang = useSyncExternalStore(noSubscribe, readBrowserLang, () => "");
  const values = browserLang ? { lang, browserLang } : { lang };

  return (
    <>
      <script
        type="application/json"
        data-flag-values=""
        // the values are "en" / "zh-TW" and a BCP 47 tag, but escape `<` anyway
        dangerouslySetInnerHTML={{ __html: JSON.stringify(values).replace(/</g, "\\u003c") }}
      />
      <VercelAnalytics
        beforeSend={(event) => ({ ...event, url: scrubAnalyticsUrl(event.url) })}
      />
    </>
  );
}

function noSubscribe() {
  return () => {};
}

function readBrowserLang(): string {
  return navigator.language.slice(0, 35);
}
