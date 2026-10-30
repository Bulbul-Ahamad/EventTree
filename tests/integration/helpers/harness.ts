import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import type { Database } from "@/types/database";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";
import { current } from "./session";

const PASSWORD = "Passw0rd!inttest";
const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

// Service-role client: set-up and clean-up only, never used to test behaviour.
export const admin: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, opts);

export type Persona = { name: string; id: string; email: string; client: SupabaseClient<Database> };

const runId = randomBytes(4).toString("hex");
const created: Persona[] = [];
const orgIds: string[] = [];

// A confirmed user signed in with the anon key, so RLS applies exactly as in the app.
export async function createPersona(name: string): Promise<Persona> {
  const email = `int-${runId}-${name}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Int ${name}` },
  });
  if (error || !data.user) throw new Error(`createUser ${name}: ${error?.message}`);

  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, opts);
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`signIn ${name}: ${signIn.error.message}`);

  const persona = { name, id: data.user.id, email, client };
  created.push(persona);
  return persona;
}

// Run server code (actions, queries) as this persona.
export function actAs(persona: Persona | null) {
  current.client = persona ? persona.client : null;
}

export function uniqueSlug(prefix = "int"): string {
  return `${prefix}-${runId}-${randomBytes(3).toString("hex")}`;
}

export function trackOrg(id: string) {
  orgIds.push(id);
}

// Removes everything this run created (children first: nodes restrict org delete).
export async function cleanup() {
  actAs(null);
  if (orgIds.length > 0) {
    await admin.from("nodes").delete().in("org_id", orgIds);
    await admin.from("organizations").delete().in("id", orgIds);
  }
  for (const p of created) await admin.auth.admin.deleteUser(p.id);
  created.length = 0;
  orgIds.length = 0;
}
