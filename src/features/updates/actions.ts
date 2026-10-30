"use server";

import { revalidatePath } from "next/cache";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { nullable } from "@/lib/rpc";
import { createServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";
import { addCommentSchema, addProofLinkSchema, transitionTaskSchema } from "./schemas";

// 02_AppFlow S13. Status changes go through the transition_task_status RPC only
// (T1-T7, E_STALE_STATE, E_COMMENT_REQUIRED are enforced there). Comments and
// proof links are plain inserts guarded by RLS.

const EVENT_PAGE = "/o/[orgSlug]/events/[eventId]";

export async function transitionTask(
  input: unknown,
): Promise<ActionResult<{ status: "todo" | "in_progress" | "submitted" | "verified" }>> {
  const parsed = transitionTaskSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const v = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("transition_task_status", {
    p_node: v.nodeId,
    p_from: v.from,
    p_to: v.to,
    p_comment: nullable(v.comment),
  });
  if (error) return failFrom(error);
  revalidatePath(EVENT_PAGE, "page");
  return ok({ status: data.status ?? v.to });
}

// Not visible -> E_NOT_FOUND; visible but RLS refuses the insert -> E_NOT_AUTHORIZED.
async function insertUpdate(
  nodeId: string,
  row: { kind: "comment"; body: string } | { kind: "proof_link"; link_url: string; body: string | null },
): Promise<ActionResult> {
  const supabase = await createServerClient();
  const { data: node } = await supabase.from("nodes").select("id").eq("id", nodeId).maybeSingle();
  if (!node) return fail("E_NOT_FOUND");

  // Only (node_id, kind, body, link_url) are insertable by clients; a trigger sets
  // event_id and user_id. The generated Insert type lists event_id as required, so
  // the cast documents that gap (the column is deliberately not granted).
  const { error } = await supabase.from("node_updates").insert({ ...row, node_id: node.id } as TablesInsert<"node_updates">);
  if (error) return failFrom(error); // RLS refusal (42501) maps to E_NOT_AUTHORIZED
  revalidatePath(EVENT_PAGE, "page");
  return ok();
}

export async function addComment(input: unknown): Promise<ActionResult> {
  const parsed = addCommentSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  return insertUpdate(parsed.data.nodeId, { kind: "comment", body: parsed.data.body });
}

export async function addProofLink(input: unknown): Promise<ActionResult> {
  const parsed = addProofLinkSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  return insertUpdate(parsed.data.nodeId, {
    kind: "proof_link",
    link_url: parsed.data.url,
    body: parsed.data.note ?? null,
  });
}
