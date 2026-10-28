import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

type RawEnv = Record<string, string | undefined>;

/** Validate a raw env source. Throws one clear error listing every problem. */
export function parseEnv(source: RawEnv): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = String(issue.path[0] ?? "(unknown)");
    const missing = source[name] === undefined || source[name] === "";
    return `  - ${name}: ${missing ? "missing" : issue.message}`;
  });
  throw new Error(
    `Invalid environment variables:\n${lines.join("\n")}\n` +
      "Copy .env.example to .env.local and fill in the values.",
  );
}

// NEXT_PUBLIC_* vars must be referenced statically so Next.js can inline them.
export const env = parseEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
