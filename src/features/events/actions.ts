"use server";

import { revalidatePath } from "next/cache";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { toErrorCode } from "@/lib/errors";
import { nullable } from "@/lib/rpc";
import { createServerClient } from "@/lib/supabase/server";
import {
  createEventSchema,
  deleteEventSchema,
  setEventStatusSchema,
  updateEventSettingsSchema,
} from "./schemas";

// Event Server Actions (02_AppFlow S10, S11, S14). Rules live in the database
// (RPCs, RLS, triggers); this layer validates, calls, maps errors, revalidates.

const EVENT_PAGE = "/o/[orgSlug]/events/[eventId]";
const EVENTS_LIST = "/o/[orgSlug]/events";

export async function createEvent(input: unknown): Promise<ActionResult<{ eventId: string }>> {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const v = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_org: v.orgId,
    p_title: v.title,
    p_description: nullable(v.description),
    p_starts_at: nullable(v.startsAt),
    p_ends_at: nullable(v.endsAt),
    p_location: nullable(v.location),
    p_review_mode: v.reviewMode,
  });
  if (error) return failFrom(error);
  revalidatePath(EVENTS_LIST, "page");
  return ok({ eventId: data });
}

// Title and description live on the event node, the rest on event_settings:
// two writes (no single RPC exists). Settings are written first because they
// are the ones most likely to be rejected by a CHECK (end before start).
export async function updateEventSettings(input: unknown): Promise<ActionResult> {
  const parsed = updateEventSettingsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const v = parsed.data;

  const supabase = await createServerClient();
  const { data: visible } = await supabase.from("nodes").select("id").eq("id", v.eventId).eq("type", "event").maybeSingle();
  if (!visible) return fail("E_NOT_FOUND");

  const settings = await supabase
    .from("event_settings")
    .update({
      review_mode: v.reviewMode,
      starts_at: v.startsAt ?? null,
      ends_at: v.endsAt ?? null,
      location: v.location ?? null,
    })
    .eq("event_id", v.eventId)
    .select("event_id")
    .maybeSingle();
  if (settings.error) return failFrom(settings.error);
  if (!settings.data) return fail("E_NOT_AUTHORIZED"); // RLS: only the owner may update

  const node = await supabase
    .from("nodes")
    .update({ title: v.title, description: v.description ?? null })
    .eq("id", v.eventId)
    .eq("type", "event")
    .select("id")
    .maybeSingle();
  if (node.error) return failFrom(node.error);
  if (!node.data) return fail("E_NOT_AUTHORIZED");

  revalidatePath(EVENT_PAGE, "page");
  revalidatePath(EVENTS_LIST, "page");
  return ok();
}

export async function setEventStatus(input: unknown): Promise<ActionResult> {
  const parsed = setEventStatusSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_event_status", {
    p_event: parsed.data.eventId,
    p_to: parsed.data.to,
  });
  if (error) return failFrom(error);
  revalidatePath(EVENT_PAGE, "page");
  revalidatePath(EVENTS_LIST, "page");
  return ok();
}

// Allowed only for the owner and only in draft/archived (RLS + guard trigger).
export async function deleteEvent(input: unknown): Promise<ActionResult> {
  const parsed = deleteEventSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { data: visible } = await supabase.from("nodes").select("id").eq("id", parsed.data.eventId).eq("type", "event").maybeSingle();
  if (!visible) return fail("E_NOT_FOUND");

  const { data, error } = await supabase
    .from("nodes")
    .delete()
    .eq("id", parsed.data.eventId)
    .eq("type", "event")
    .select("id")
    .maybeSingle();
  if (error) return fail(toErrorCode(error));
  if (!data) return fail("E_NOT_AUTHORIZED");
  revalidatePath(EVENTS_LIST, "page");
  return ok();
}
