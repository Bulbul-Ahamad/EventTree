import "server-only";
import type { EventStatus } from "@/lib/permissions";
import { createServerClient } from "@/lib/supabase/server";
import {
  compareMyEvents,
  groupMyTasks,
  pickEventRole,
  type MyEventRole,
  type MyTask,
  type MyTaskGroups,
} from "./grouping";

// Dashboard reads (02_AppFlow S08). The RPCs are SECURITY INVOKER, so RLS and
// the self-verify rule decide what each user sees.

export type ReviewItem = {
  nodeId: string;
  title: string;
  assigneeName: string | null;
  submittedAt: string | null;
  eventId: string;
  eventTitle: string;
  orgSlug: string;
};

export type MyEvent = {
  id: string;
  title: string;
  orgName: string;
  orgSlug: string;
  status: EventStatus;
  progress: number;
  role: MyEventRole;
};

// Tasks assigned to me in draft/active events, in four groups.
export async function getMyTasks(now: Date = new Date()): Promise<MyTaskGroups> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_my_tasks");
  if (error) throw new Error("E_UNKNOWN");
  const tasks: MyTask[] = data.map((r) => ({
    nodeId: r.node_id,
    title: r.title,
    status: r.status,
    priority: r.priority,
    dueAt: r.due_at,
    eventId: r.event_id,
    eventTitle: r.event_title,
    eventStatus: r.event_status,
    orgSlug: r.org_slug,
  }));
  return groupMyTasks(tasks, now);
}

// Submitted tasks I may verify, oldest first. Empty means the section is hidden.
export async function getReviewQueue(): Promise<ReviewItem[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_review_queue");
  if (error) throw new Error("E_UNKNOWN");
  return data.map((r) => ({
    nodeId: r.node_id,
    title: r.title,
    assigneeName: r.assignee_name,
    submittedAt: r.submitted_at,
    eventId: r.event_id,
    eventTitle: r.event_title,
    orgSlug: r.org_slug,
  }));
}

// Events I take part in (event_members), across all my organizations.
// Org admins only see events here where they are assigned (not every org event).
export async function getMyEvents(): Promise<MyEvent[]> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships, error: memberError } = await supabase
    .from("event_members")
    .select("event_id")
    .eq("user_id", user.id);
  if (memberError) throw new Error("E_UNKNOWN");
  const eventIds = memberships.map((m) => m.event_id);
  if (eventIds.length === 0) return [];

  const [events, segments] = await Promise.all([
    supabase
      .from("nodes")
      .select("id, title, progress_cached, assignee_id, event_settings!inner(event_status), organizations(name, slug)")
      .eq("type", "event")
      .in("id", eventIds),
    supabase
      .from("nodes")
      .select("event_id")
      .eq("type", "segment")
      .eq("assignee_id", user.id)
      .in("event_id", eventIds),
  ]);
  if (events.error || segments.error) throw new Error("E_UNKNOWN");

  const headOf = new Set(segments.data.map((s) => s.event_id));
  return events.data
    .map((e) => ({
      id: e.id,
      title: e.title,
      orgName: e.organizations?.name ?? "",
      orgSlug: e.organizations?.slug ?? "",
      status: e.event_settings.event_status,
      progress: Number(e.progress_cached),
      role: pickEventRole(user.id, e.assignee_id, headOf.has(e.id)),
    }))
    .sort(compareMyEvents);
}
