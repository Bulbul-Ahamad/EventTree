import { existsSync } from "node:fs";

// Integration tests talk to the LOCAL Supabase stack (pnpm db:start).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Integration tests need ${name} in .env.local (see .env.example) and a running local Supabase.`);
  }
  return value;
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL");
export const ANON_KEY = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const SERVICE_ROLE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(SUPABASE_URL)) {
  throw new Error(`Refusing to run integration tests against ${SUPABASE_URL}: local Supabase only.`);
}
