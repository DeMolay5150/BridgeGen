/**
 * A post-sign-in destination from a `?next=` parameter, or the fallback.
 * Only same-site paths are allowed, so the parameter can't be used to bounce
 * a freshly signed-in advisor to another site.
 */
export function safeNext(next: string | null | undefined, fallback = "/companies"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // Reject anything a URL parser would read as leaving the site (e.g. "/\t/evil.com").
  try {
    const url = new URL(next, "https://bridgegen.invalid");
    return url.origin === "https://bridgegen.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
