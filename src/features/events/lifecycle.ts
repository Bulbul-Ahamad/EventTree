import type { EventStatus } from "@/lib/permissions";

// What the Owner can do next, with the confirmation copy (02_AppFlow §6).
// Pure so it is unit tested. The database decides what is really allowed.

export type LifecycleStep = {
  to: EventStatus;
  label: string;
  title: string;
  description: string;
  warning: string | null; // non-blocking
  toast: string;
};

type Facts = { progress: number; unassignedCount: number };

export function lifecycleSteps(status: EventStatus, facts: Facts): LifecycleStep[] {
  switch (status) {
    case "draft":
      return [
        {
          to: "active",
          label: "Activate event",
          title: "Activate this event?",
          description: "Assignees can start updating their tasks.",
          warning:
            facts.unassignedCount > 0
              ? `${facts.unassignedCount} ${facts.unassignedCount === 1 ? "item has" : "items have"} no assignee yet. You can still activate.`
              : null,
          toast: "Event activated",
        },
      ];
    case "active":
      return [
        {
          to: "completed",
          label: "Mark completed",
          title: "Mark this event as completed?",
          description: "The event becomes read-only. You can reopen it later.",
          warning:
            Math.round(facts.progress) < 100
              ? `Overall progress is ${Math.round(facts.progress)}%, so some work is not verified yet.`
              : null,
          toast: "Event marked as completed",
        },
      ];
    case "completed":
      return [
        {
          to: "active",
          label: "Reopen",
          title: "Reopen this event?",
          description: "Task updates will be enabled again.",
          warning: null,
          toast: "Event reopened",
        },
        {
          to: "archived",
          label: "Archive",
          title: "Archive this event?",
          description: "It moves to the Archived tab and stays read-only.",
          warning: null,
          toast: "Event archived",
        },
      ];
    case "archived":
      return [
        {
          to: "completed",
          label: "Unarchive",
          title: "Unarchive this event?",
          description: "It goes back to Completed.",
          warning: null,
          toast: "Event unarchived",
        },
      ];
  }
}
