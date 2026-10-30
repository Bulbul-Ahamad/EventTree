import type { ErrorCode } from "@/lib/errors";
import {
  canChangeTaskStatus,
  canSendBackOrReopen,
  canSubmitTask,
  canToggleProgress,
  canVerifyTask,
  type EventContext,
  type NodeContext,
  type TaskStatus,
} from "@/lib/permissions";

// Task status state machine: docs/02_AppFlow.md §5, mirrors the database
// function transition_task_status (05_Schema §6.1). UI only; the DB decides.

export type TransitionId = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7";

export type Transition = {
  id: TransitionId;
  from: TaskStatus;
  to: TaskStatus;
  label: string; // button text
  commentRequired: boolean; // T5 and T7 (E_COMMENT_REQUIRED)
};

type Rule = Transition & {
  allowed: (ctx: EventContext, node: NodeContext) => boolean;
};

const RULES: readonly Rule[] = [
  { id: "T1", from: "todo", to: "in_progress", label: "Start", commentRequired: false, allowed: canToggleProgress },
  { id: "T2", from: "in_progress", to: "todo", label: "Move back to To do", commentRequired: false, allowed: canToggleProgress },
  { id: "T3", from: "in_progress", to: "submitted", label: "Submit for review", commentRequired: false, allowed: canSubmitTask },
  // T4 is not limited to Mode A: tasks already submitted can still be verified after a mode change.
  { id: "T4", from: "submitted", to: "verified", label: "Verify", commentRequired: false, allowed: canVerifyTask },
  { id: "T5", from: "submitted", to: "in_progress", label: "Send back", commentRequired: true, allowed: canSendBackOrReopen },
  {
    id: "T6",
    from: "todo",
    to: "verified",
    label: "Verify",
    commentRequired: false,
    allowed: (ctx, node) => ctx.reviewMode === "head_only" && canVerifyTask(ctx, node),
  },
  {
    id: "T6",
    from: "in_progress",
    to: "verified",
    label: "Verify",
    commentRequired: false,
    allowed: (ctx, node) => ctx.reviewMode === "head_only" && canVerifyTask(ctx, node),
  },
  { id: "T7", from: "verified", to: "in_progress", label: "Reopen", commentRequired: true, allowed: canSendBackOrReopen },
];

function strip({ allowed: _allowed, ...transition }: Rule): Transition {
  return transition;
}

// Transitions the viewer may perform on a task that is currently `status`.
// Empty when the event is not active.
export function allowedTransitions(
  ctx: EventContext,
  node: NodeContext,
  status: TaskStatus,
): Transition[] {
  if (node.type !== "task" || !canChangeTaskStatus(ctx.eventStatus)) return [];
  return RULES.filter((r) => r.from === status && r.allowed(ctx, node)).map(strip);
}

export function findTransition(
  ctx: EventContext,
  node: NodeContext,
  from: TaskStatus,
  to: TaskStatus,
): Transition | null {
  return allowedTransitions(ctx, node, from).find((t) => t.to === to) ?? null;
}

// The error the database would raise for this attempt, or null when it is
// allowed. Same order as the DB: event active, legal transition, comment.
// (E_STALE_STATE needs the live row, so only the server can raise it.)
export function transitionError(
  ctx: EventContext,
  node: NodeContext,
  from: TaskStatus,
  to: TaskStatus,
  comment?: string | null,
): ErrorCode | null {
  if (!canChangeTaskStatus(ctx.eventStatus)) return "E_EVENT_NOT_ACTIVE";
  const t = findTransition(ctx, node, from, to);
  if (!t) return "E_INVALID_TRANSITION";
  if (t.commentRequired && (comment ?? "").trim().length === 0) return "E_COMMENT_REQUIRED";
  return null;
}
