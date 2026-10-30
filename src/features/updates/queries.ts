import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ActivityItem = {
  id: string;
  kind: Database["public"]["Enums"]["update_kind"];
  body: string | null;
  linkUrl: string | null;
  fromStatus: Database["public"]["Enums"]["task_status"] | null;
  toStatus: Database["public"]["Enums"]["task_status"] | null;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
};

// 02_AppFlow S13: activity timeline, newest first. RLS limits it to events the
// caller can see, so an invisible node simply has no rows (empty list).
export async function getNodeActivity(nodeId: string, limit = 100): Promise<ActivityItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("node_updates")
    .select("id, kind, body, link_url, from_status, to_status, created_at, user_id, profiles!node_updates_user_id_fkey(full_name, avatar_url)")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error("E_UNKNOWN");
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    linkUrl: r.link_url,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    createdAt: r.created_at,
    authorId: r.user_id,
    authorName: r.profiles?.full_name ?? null,
    authorAvatar: r.profiles?.avatar_url ?? null,
  }));
}
