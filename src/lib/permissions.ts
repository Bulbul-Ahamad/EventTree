import type { Database } from "@/types/database";

// UI-gating mirror of the database rules (docs/01_PRD.md §6-7, 05_Schema §4-5).
// The database is the real enforcement; these functions only decide what to
// show. Pure functions: pass the facts in, get a boolean back.

type Enums = Database["public"]["Enums"];
export type NodeType = Enums["node_type"];
export type TaskStatus = Enums["task_status"];
export type EventStatus = Enums["event_status"];
export type ReviewMode = Enums["review_mode"];

// Facts about the viewer and the event the node belongs to.
export type EventContext = {
  userId: string;
  ownerId: string; // assignee of the event root
  eventStatus: EventStatus;
  reviewMode: ReviewMode;
  isOrgAdmin: boolean; // admin of the event's organization
  isParticipant: boolean; // assigned to at least one node of the event (event_members)
};

// Facts about one node. `ancestorAssigneeIds` = assignees of every proper
// ancestor (event first, then segments). Ancestors are never tasks.
export type NodeContext = {
  type: NodeType;
  assigneeId: string | null;
  ancestorAssigneeIds: ReadonlyArray<string | null>;
};

// ---- roles ---------------------------------------------------------------

export function isEventOwner(ctx: EventContext): boolean {
  return ctx.userId === ctx.ownerId;
}

export function isAssigneeOf(ctx: EventContext, node: NodeContext): boolean {
  return node.assigneeId === ctx.userId;
}

// Strict Manager: assignee of any proper ancestor (01_PRD §3).
export function isStrictManagerOf(ctx: EventContext, node: NodeContext): boolean {
  return node.ancestorAssigneeIds.includes(ctx.userId);
}

// Manager: assignee of the node itself (if event/segment) or of any ancestor.
export function isManagerOf(ctx: EventContext, node: NodeContext): boolean {
  return (node.type !== "task" && isAssigneeOf(ctx, node)) || isStrictManagerOf(ctx, node);
}

// Verifier: strict manager who is not the task's assignee, or the Owner (BR / US-11 AC2).
export function isVerifierOf(ctx: EventContext, node: NodeContext): boolean {
  return isEventOwner(ctx) || (isStrictManagerOf(ctx, node) && !isAssigneeOf(ctx, node));
}

// ---- event lifecycle (BR-10) ----------------------------------------------

// Structure edits (add, edit, delete nodes): draft and active only.
export function canWriteStructure(status: EventStatus): boolean {
  return status === "draft" || status === "active";
}

// Task status changes: active only.
export function canChangeTaskStatus(status: EventStatus): boolean {
  return status === "active";
}

const LIFECYCLE: Record<EventStatus, readonly EventStatus[]> = {
  draft: ["active"],
  active: ["completed"],
  completed: ["active", "archived"],
  archived: ["completed"],
};

// ---- permissions ---------------------------------------------------------

// BR-03: assigned to a node in the event, or admin of its organization.
export function canViewEvent(ctx: EventContext): boolean {
  return ctx.isParticipant || ctx.isOrgAdmin;
}

export function canEditEventSettings(ctx: EventContext): boolean {
  return isEventOwner(ctx);
}

export function allowedEventStatusTargets(ctx: EventContext): readonly EventStatus[] {
  return isEventOwner(ctx) ? LIFECYCLE[ctx.eventStatus] : [];
}

export function canSetEventStatus(ctx: EventContext, to: EventStatus): boolean {
  return allowedEventStatusTargets(ctx).includes(to);
}

export function canDeleteEvent(ctx: EventContext): boolean {
  return isEventOwner(ctx) && (ctx.eventStatus === "draft" || ctx.eventStatus === "archived");
}

export function canCreateChild(ctx: EventContext, parent: NodeContext): boolean {
  return parent.type !== "task" && canWriteStructure(ctx.eventStatus) && isManagerOf(ctx, parent);
}

export function canEditNode(ctx: EventContext, node: NodeContext): boolean {
  if (!canWriteStructure(ctx.eventStatus)) return false;
  return node.type === "event" ? isEventOwner(ctx) : isStrictManagerOf(ctx, node);
}

// BR-01: the event owner cannot be changed.
export function canReassignNode(ctx: EventContext, node: NodeContext): boolean {
  return node.type !== "event" && canWriteStructure(ctx.eventStatus) && isStrictManagerOf(ctx, node);
}

export function canDeleteNode(ctx: EventContext, node: NodeContext): boolean {
  if (node.type === "event") return canDeleteEvent(ctx);
  return canWriteStructure(ctx.eventStatus) && isStrictManagerOf(ctx, node);
}

// todo <-> in_progress (T1, T2): the task's assignee or a strict manager.
export function canToggleProgress(ctx: EventContext, node: NodeContext): boolean {
  return (
    node.type === "task" &&
    canChangeTaskStatus(ctx.eventStatus) &&
    (isAssigneeOf(ctx, node) || isStrictManagerOf(ctx, node))
  );
}

// in_progress -> submitted (T3): assignee only, Mode A only. A manager who
// is also the assignee submits as assignee.
export function canSubmitTask(ctx: EventContext, node: NodeContext): boolean {
  return (
    node.type === "task" &&
    canChangeTaskStatus(ctx.eventStatus) &&
    ctx.reviewMode === "assignee_submits" &&
    isAssigneeOf(ctx, node)
  );
}

// Verify (T4, T6), send back (T5) and reopen (T7) need a verifier or manager.
// Which exact transition is legal for the task's current status: lib/status.ts.
export function canVerifyTask(ctx: EventContext, node: NodeContext): boolean {
  return node.type === "task" && canChangeTaskStatus(ctx.eventStatus) && isVerifierOf(ctx, node);
}

export function canSendBackOrReopen(ctx: EventContext, node: NodeContext): boolean {
  return (
    node.type === "task" &&
    canChangeTaskStatus(ctx.eventStatus) &&
    (isEventOwner(ctx) || isStrictManagerOf(ctx, node))
  );
}

// Comment / proof link (S12): the node's assignee or a manager of it, while
// the event is draft or active.
export function canComment(ctx: EventContext, node: NodeContext): boolean {
  return canWriteStructure(ctx.eventStatus) && (isAssigneeOf(ctx, node) || isManagerOf(ctx, node));
}
