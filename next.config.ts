import type { NextConfig } from "next";

/**
 * Browser hardening for every response. HSTS comes from Vercel. The CSP holds
 * only directives that can't break the app (no framing, no <base> hijack, no
 * plugins); a script/connect policy would also need Next's inline scripts,
 * Supabase (incl. realtime websockets) and Storage media allowed.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  // Older browsers that don't support frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Invite pages (/join, /respond) tighten this to no-referrer in their metadata.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  // /white-paper reads its Markdown source from disk.
  outputFileTracingIncludes: { "/white-paper": ["./docs/white-paper.md"] },
  headers: async () => [{ source: "/:path*", headers: SECURITY_HEADERS }],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
