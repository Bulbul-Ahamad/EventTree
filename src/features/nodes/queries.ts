import "server-only";
import { buildTree, type TreeNode } from "@/lib/tree";
import { createServerClient } from "@/lib/supabase/server";

// Tree read (TRD §6): one RPC returns the flat rows the caller may see, then
// lib/tree.ts nests them. No N+1 queries. Returns null when the event does not
// exist or the caller cannot see it (404 policy).
export async function getEventTree(eventId: string): Promise<TreeNode | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_event_tree", { p_event: eventId });
  if (error) throw new Error("E_UNKNOWN");
  return buildTree(data);
}
