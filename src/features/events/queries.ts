import "server-only";
import type { EventContext, EventStatus, ReviewMode } from "@/lib/permissions";
import { createServerClient } from "@/lib/supabase/server";

// Event reads for Server Components (TRD §6). RLS decides visibility (BR-03):
// org admins see all events of their org, everyone else only events they are
// assigned in. A missing result means "not found" (never 403, 02_AppFlow §1).

export const EVENT_TABS = ["active", "completed", "archived"] as const;
export type EventTab = (typeof EVENT_TABS)[number];

// "Active" tab = draft + active (02_AppFlow S09).
const TAB_STATUSES: Record<EventTab, EventStatus[]> = {
  active: ["draft", "active"],
  completed: ["completed"],
  archived: ["archived"],
};

export function parseEventTab(value: string | null | undefined): EventTab {
  return (EVENT_TABS as readonly string[]).includes(value ?? "") ? (value as EventTab) : "active";
}

export type EventSummary = {
  id: string;
  title: string;
  status: EventStatus;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  progress: number;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatar: string | null;
};

export type EventDetail = EventSummary & {
  orgId: string;
  description: string | null;
  reviewMode: ReviewMode;
  completedAt: string | null;
};

const SETTINGS = "event_settings!inner(event_status, review_mode, starts_at, ends_at, location, completed_at)";
const OWNER = "profiles!nodes_assignee_id_fkey(full_name, avatar_url)";

export async function listEvents(orgId: string, tab: EventTab): Promise<EventSummary[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("nodes")
    .select(`id, title, progress_cached, assignee_id, created_at, ${SETTINGS}, ${OWNER}`)
    .eq("org_id", orgId)
    .eq("type", "event")
    .in("event_settings.event_status", TAB_STATUSES[tab])
    .order("created_at", { ascending: false });
  if (error) throw new Error("E_UNKNOWN");

  return data.map((n) => ({
    id: n.id,
    title: n.title,
    status: n.event_settings.event_status,
    startsAt: n.event_settings.starts_at,
    endsAt: n.event_settings.ends_at,
    location: n.event_settings.location,
    progress: Number(n.progress_cached),
    ownerId: n.assignee_id,
    ownerName: n.profiles?.full_name ?? null,
    ownerAvatar: n.profiles?.avatar_url ?? null,
  }));
}

// One event with its settings, or null when it does not exist or I cannot see it.
export async function getEvent(eventId: string): Promise<EventDetail | null> {
  const supabase = await createServerClient();
  const { data: n } = await supabase
    .from("nodes")
    .select(`id, org_id, title, description, progress_cached, assignee_id, ${SETTINGS}, ${OWNER}`)
    .eq("id", eventId)
    .eq("type", "event")
    .maybeSingle();
  if (!n) return null;

  return {
    id: n.id,
    orgId: n.org_id,
    title: n.title,
    description: n.description,
    status: n.event_settings.event_status,
    reviewMode: n.event_settings.review_mode,
    startsAt: n.event_settings.starts_at,
    endsAt: n.event_settings.ends_at,
    location: n.event_settings.location,
    completedAt: n.event_settings.completed_at,
    progress: Number(n.progress_cached),
    ownerId: n.assignee_id,
    ownerName: n.profiles?.full_name ?? null,
    ownerAvatar: n.profiles?.avatar_url ?? null,
  };
}

// Facts for lib/permissions.ts about the signed-in user and this event, or
// null when the user cannot see the event.
export async function getEventContext(eventId: string): Promise<EventContext | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const event = await getEvent(eventId);
  if (!event || !event.ownerId) return null;

  const [{ data: member }, { data: orgRole }] = await Promise.all([
    supabase.from("event_members").select("user_id").eq("event_id", eventId).eq("user_id", user.id).maybeSingle(),
    supabase.from("org_members").select("role").eq("org_id", event.orgId).eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    userId: user.id,
    ownerId: event.ownerId,
    eventStatus: event.status,
    reviewMode: event.reviewMode,
    isOrgAdmin: orgRole?.role === "admin",
    isParticipant: member !== null,
  };
}
