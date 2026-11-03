"use client";

import { Analytics } from "@vercel/analytics/next";
import { redactUrl } from "@/lib/analytics/redact";

/** Vercel Web Analytics (page views only on Hobby), with invite tokens, ids and query strings removed. */
export function SiteAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />;
}
