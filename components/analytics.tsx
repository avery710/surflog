"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { scrubAnalyticsUrl } from "@/lib/analytics-url";

/**
 * Vercel Web Analytics (SURFLOG-33): cookieless page views, visitor counts
 * and country. No user is identified and no custom events carry user data.
 * Client component because `beforeSend` is a function. Only active on Vercel
 * deployments (it does nothing under `next dev`).
 */
export function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => ({ ...event, url: scrubAnalyticsUrl(event.url) })}
    />
  );
}
