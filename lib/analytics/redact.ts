/**
 * Strips anything confidential from a URL before it reaches Vercel Web Analytics.
 * Invite links (/respond/<token>, /join/<token>) carry secrets; ids identify clients.
 * Query strings and hashes are dropped entirely (they can hold ?next= paths or tokens).
 */
const TOKEN_ROUTES = new Set(["respond", "join"]);
const ID = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

export function redactUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "/";
  }
  const parts = url.pathname.split("/");
  const path = parts
    .map((part, i) => (i > 0 && TOKEN_ROUTES.has(parts[i - 1]) ? ":token" : ID.test(part) ? ":id" : part))
    .join("/");
  return `${url.origin}${path}`;
}
