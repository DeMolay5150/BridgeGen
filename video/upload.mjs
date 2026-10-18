/**
 * Uploads the rendered walkthrough to Supabase Storage for the /walkthrough page.
 *
 *   pnpm video:render --out ../public/walkthrough.mp4
 *   pnpm video:render --still 8 --out ../public/walkthrough-poster.png
 *   pnpm video:upload                     # both files → public bucket "media"
 *
 * Creates the public bucket if it's missing (MP4/PNG only, 50 MB cap; no
 * write policies, so only this secret-key script can write). Overwrites the
 * same paths on every upload; the page's URLs never change. Reads the project
 * URL and secret key from ../.env.local. Paths come from lib/walkthrough.ts.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  WALKTHROUGH_BUCKET,
  WALKTHROUGH_CACHE_SECONDS,
  WALKTHROUGH_POSTER_PATH,
  WALKTHROUGH_VIDEO_PATH,
} from "../lib/walkthrough.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
// The app's own supabase-js: no separate copy in the video package.
const { createClient } = createRequire(join(root, "package.json"))("@supabase/supabase-js");

const { values: args } = parseArgs({
  options: {
    video: { type: "string", default: join(root, "public/walkthrough.mp4") },
    poster: { type: "string", default: join(root, "public/walkthrough-poster.png") },
  },
});

if (existsSync(join(root, ".env.local"))) process.loadEnvFile(join(root, ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local");

const files = [
  { local: resolve(args.video), path: WALKTHROUGH_VIDEO_PATH, contentType: "video/mp4" },
  { local: resolve(args.poster), path: WALKTHROUGH_POSTER_PATH, contentType: "image/png" },
];
for (const f of files) {
  if (!existsSync(f.local)) throw new Error(`Missing ${f.local}. Render it first (see the usage at the top of this file).`);
}

const storage = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
const BUCKET_SETTINGS = { public: true, fileSizeLimit: "50MB", allowedMimeTypes: ["video/mp4", "image/png"] };

const { data: existing } = await storage.getBucket(WALKTHROUGH_BUCKET);
if (!existing) {
  const { error } = await storage.createBucket(WALKTHROUGH_BUCKET, BUCKET_SETTINGS);
  if (error) throw new Error(`Couldn't create bucket "${WALKTHROUGH_BUCKET}": ${error.message}`);
  console.log(`Created public bucket "${WALKTHROUGH_BUCKET}"`);
} else if (!existing.public) {
  throw new Error(`Bucket "${WALKTHROUGH_BUCKET}" exists but is private; the page needs a public bucket. Not changing it automatically.`);
}

for (const f of files) {
  const { error } = await storage.from(WALKTHROUGH_BUCKET).upload(f.path, readFileSync(f.local), {
    contentType: f.contentType,
    cacheControl: String(WALKTHROUGH_CACHE_SECONDS),
    upsert: true,
  });
  if (error) throw new Error(`Upload of ${f.path} failed: ${error.message}`);
  const { data } = storage.from(WALKTHROUGH_BUCKET).getPublicUrl(f.path);
  console.log(`${f.path} (${(statSync(f.local).size / 1e6).toFixed(1)} MB) → ${data.publicUrl}`);
}
