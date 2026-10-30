import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// The client that the mocked `createServerClient` hands to server code.
export const current: { client: SupabaseClient<Database> | null } = { client: null };
