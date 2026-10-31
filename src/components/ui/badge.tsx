import {
  Archive,
  CheckCircle2,
  Circle,
  CircleDashed,
  Flag,
  Hourglass,
  Loader,
  Play,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";
import type { EventStatus, TaskStatus } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.4 (badges), §2.2 (status colors), §2.3 (priority colors).
// Class names are written out in full so Tailwind can see them.

const BASE =
  "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium [&_svg]:size-3.5 [&_svg]:shrink-0";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn(BASE, className)} {...props} />;
}

type Palette = "todo" | "in_progress" | "submitted" | "verified";

const PALETTE: Record<Palette, string> = {
  todo: "bg-status-todo-bg text-status-todo-fg",
  in_progress: "bg-status-in_progress-bg text-status-in_progress-fg",
  submitted: "bg-status-submitted-bg text-status-submitted-fg",
  verified: "bg-status-verified-bg text-status-verified-fg",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  submitted: "Submitted",
  verified: "Verified",
};

const STATUS_ICONS: Record<TaskStatus, LucideIcon> = {
  todo: Circle,
  in_progress: Loader,
  submitted: Hourglass,
  verified: CheckCircle2,
};

// Task status. Colour is never the only signal: icon and label always show.
// `iconOnly` keeps the label for screen readers and shows just the icon (small screens).
export function StatusBadge({
  status,
  iconOnly = false,
  className,
}: {
  status: TaskStatus;
  iconOnly?: boolean;
  className?: string;
}) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge className={cn(PALETTE[status], iconOnly && "px-1.5", className)}>
      <Icon aria-hidden />
      <span className={iconOnly ? "sr-only" : undefined}>{STATUS_LABELS[status]}</span>
    </Badge>
  );
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

const EVENT_STATUS_STYLE: Record<EventStatus, { palette: Palette; icon: LucideIcon }> = {
  draft: { palette: "todo", icon: CircleDashed },
  active: { palette: "in_progress", icon: Play },
  completed: { palette: "verified", icon: CheckCircle2 },
  archived: { palette: "todo", icon: Archive },
};

export function EventStatusBadge({ status, className }: { status: EventStatus; className?: string }) {
  const { palette, icon: Icon } = EVENT_STATUS_STYLE[status];
  return (
    <Badge className={cn(PALETTE[palette], className)}>
      <Icon aria-hidden />
      {EVENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export type Role = "owner" | "head" | "assignee";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  head: "Head",
  assignee: "Assignee",
};

export function RoleChip({ role, className }: { role: Role; className?: string }) {
  return <Badge className={cn("bg-primary-soft text-primary", className)}>{ROLE_LABELS[role]}</Badge>;
}

export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_TEXT: Record<Priority, string> = {
  low: "text-priority-low",
  medium: "text-priority-medium",
  high: "text-priority-high",
  urgent: "text-priority-urgent",
};

// Priority: Flag icon + label in the priority colour (§2.3).
export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium [&_svg]:size-3.5", PRIORITY_TEXT[priority], className)}>
      <Flag aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}
