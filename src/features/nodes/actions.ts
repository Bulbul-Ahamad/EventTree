"use server";

import { revalidatePath } from "next/cache";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { nullable } from "@/lib/rpc";
import { createServerClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";
import {
  createNodeSchema,
  deleteNodeSchema,
  reassignNodeSchema,
  updateNodeSchema,
} from "./schemas";

// Node Server Actions (02_AppFlow S11, S13). Authority, depth, limits, lifecycle
// and org checks are enforced by RLS and triggers; errors come back as E_ codes.

const EVENT_PAGE = "/o/[orgSlug]/events/[eventId]";

type NodeUpdate = TablesUpdate<"nodes">;

export async function createNode(input: unknown): Promise<ActionResult<{ nodeId: string }>> {
  const parsed = createNodeSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const v = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("create_node", {
    p_parent: v.parentId,
    p_type: v.type,
    p_title: v.title,
    p_description: nullable(v.description),
    p_assignee: nullable(v.assigneeId),
    p_due_at: nullable(v.dueAt),
    p_priority: v.priority,
    p_weight: v.weight,
  });
  if (error) return failFrom(error);
  revalidatePath(EVENT_PAGE, "page");
  return ok({ nodeId: data.id });
}

// Shared by update and reassign: not visible -> E_NOT_FOUND, visible but the
// update touched no row (RLS) -> E_NOT_AUTHORIZED.
async function updateNodeRow(nodeId: string, patch: NodeUpdate): Promise<ActionResult> {
  const supabase = await createServerClient();
  const { data: visible } = await supabase.from("nodes").select("id").eq("id", nodeId).maybeSingle();
  if (!visible) return fail("E_NOT_FOUND");

  const { data, error } = await supabase.from("nodes").update(patch).eq("id", nodeId).select("id").maybeSingle();
  if (error) return failFrom(error);
  if (!data) return fail("E_NOT_AUTHORIZED");
  revalidatePath(EVENT_PAGE, "page");
  return ok();
}

// Only fields that were sent are changed; null clears description or due date.
export async function updateNode(input: unknown): Promise<ActionResult> {
  const parsed = updateNodeSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { nodeId, title, description, dueAt, priority, weight } = parsed.data;

  const patch: NodeUpdate = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (dueAt !== undefined) patch.due_at = dueAt;
  if (priority !== undefined) patch.priority = priority;
  if (weight !== undefined) patch.weight = weight;
  return updateNodeRow(nodeId, patch);
}

export async function reassignNode(input: unknown): Promise<ActionResult> {
  const parsed = reassignNodeSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  return updateNodeRow(parsed.data.nodeId, { assignee_id: parsed.data.assigneeId });
}

// Deletes the node and its whole subtree (and their history).
export async function deleteNode(input: unknown): Promise<ActionResult> {
  const parsed = deleteNodeSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { data: visible } = await supabase.from("nodes").select("id").eq("id", parsed.data.nodeId).maybeSingle();
  if (!visible) return fail("E_NOT_FOUND");

  const { data, error } = await supabase.from("nodes").delete().eq("id", parsed.data.nodeId).select("id").maybeSingle();
  if (error) return failFrom(error);
  if (!data) return fail("E_NOT_AUTHORIZED");
  revalidatePath(EVENT_PAGE, "page");
  return ok();
}
