import { z } from "zod";

const publicSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export type PublicSupabaseEnv = z.infer<typeof publicSchema>;

/**
 * Public Supabase settings, or null when Supabase isn't configured (the app
 * then runs as the in-memory public demo). `process.env.NEXT_PUBLIC_*` must be
 * referenced literally so Next.js inlines them into the client bundle.
 */
export function publicSupabaseEnv(): PublicSupabaseEnv | null {
  const parsed = publicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export const isSupabaseConfigured = () => publicSupabaseEnv() !== null;

/** Server-only secret key. Throws a clear error when it's missing. */
export function supabaseSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || key.length < 20) {
    throw new Error("SUPABASE_SECRET_KEY is not set. Copy .env.example to .env.local and fill it in.");
  }
  return key;
}
