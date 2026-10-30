import type { EventStatus } from "@/lib/permissions";

// Pure helpers for the dashboard (02_AppFlow S08). No I/O so they are unit tested.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type MyTask = {
  nodeId: string;
  title: string;
  status: "todo" | "in_progress" | "submitted" | "verified" | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: string | null;
  eventId: string;
  eventTitle: string;
  eventStatus: EventStatus;
  orgSlug: string;
};

export type MyTaskGroups = {
  overdue: MyTask[];
  dueThisWeek: MyTask[];
  later: MyTask[];
  noDueDate: MyTask[];
};

// BR-09: overdue = due in the past, not verified, event active.
// "Due this week" = due within the next 7 days (decision 2026-10-31).
// A past due date that is not overdue (verified task, or event still a draft)
// has nothing to chase, so it sits in "Due this week" rather than vanishing.
// Input order (overdue first, then due date) is kept inside each group.
export function groupMyTasks(tasks: MyTask[], now: Date): MyTaskGroups {
  const t = now.getTime();
  const groups: MyTaskGroups = { overdue: [], dueThisWeek: [], later: [], noDueDate: [] };
  for (const task of tasks) {
    if (task.dueAt === null) {
      groups.noDueDate.push(task);
      continue;
    }
    const due = new Date(task.dueAt).getTime();
    if (due < t && task.status !== "verified" && task.eventStatus === "active") groups.overdue.push(task);
    else if (due <= t + WEEK_MS) groups.dueThisWeek.push(task);
    else groups.later.push(task);
  }
  return groups;
}

export type MyEventRole = "owner" | "head" | "assignee";

// Owner = assignee of the event node, Head = assignee of any segment in it,
// otherwise the user is in the event through a task.
export function pickEventRole(userId: string, ownerId: string | null, headOfSegment: boolean): MyEventRole {
  if (ownerId === userId) return "owner";
  return headOfSegment ? "head" : "assignee";
}

const STATUS_ORDER: Record<EventStatus, number> = { active: 0, draft: 1, completed: 2, archived: 3 };

export function compareMyEvents(
  a: { status: EventStatus; title: string },
  b: { status: EventStatus; title: string },
): number {
  return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.title.localeCompare(b.title);
}
