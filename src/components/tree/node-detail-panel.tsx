"use client";

import { UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, PriorityLabel, STATUS_LABELS, StatusBadge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { RelativeTime } from "@/components/ui/relative-time";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ActivityItem } from "@/features/updates/queries";
import { formatDateTime } from "@/lib/format-date";
import { canComment, type EventContext, type NodeContext } from "@/lib/permissions";
import { breadcrumbOf, subtreeSummary, type TreeNode } from "@/lib/tree";
import { ActivityTimeline } from "./activity-timeline";
import { CommentComposer } from "./comment-composer";

// S12 (02_AppFlow): right drawer on desktop, full-screen sheet on mobile. Opens
// from `?node=`; closing removes it. Status actions arrive in 3.10.

const TYPE_LABEL = { event: "Event", segment: "Segment", task: "Task" } as const;
const STATUS_ORDER = ["todo", "in_progress", "submitted", "verified"] as const;

type Props = {
  root: TreeNode;
  node: TreeNode;
  ctx: EventContext;
  nodeCtx: NodeContext;
  activity: ActivityItem[] | null; // null while loading
  overdue: boolean;
  onNavigate: (id: string) => void;
  onClose: () => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function NodeDetailPanel({ root, node, ctx, nodeCtx, activity, overdue, onNavigate, onClose }: Props) {
  const crumbs = breadcrumbOf(root, node.id);
  const isTask = node.type === "task";
  const summary = isTask ? null : subtreeSummary(node);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        onCloseAutoFocus={(e) => {
          // Put focus back on the row that was open, not on the page.
          e.preventDefault();
          document.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`)?.focus();
        }}
      >
        <SheetHeader>
          {crumbs.length > 0 ? (
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-foreground-muted">
                {crumbs.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-1">
                    {i > 0 ? <span aria-hidden>›</span> : null}
                    <button type="button" onClick={() => onNavigate(c.id)} className="cursor-pointer rounded-sm underline-offset-2 hover:underline">
                      {c.title}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <Badge className="self-start bg-surface-muted text-foreground-muted">{TYPE_LABEL[node.type]}</Badge>
          <SheetTitle className="break-words">{node.title}</SheetTitle>
          <SheetDescription className="sr-only">Details and activity for this item.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 p-4 md:p-6">
          {node.description ? <p className="whitespace-pre-wrap break-words text-sm">{node.description}</p> : null}

          <dl className="flex flex-col gap-3">
            <Row label={node.type === "event" ? "Owner" : node.type === "segment" ? "Head" : "Assignee"}>
              {node.assignee_id ? (
                <span className="flex items-center gap-2">
                  <Avatar id={node.assignee_id} name={node.assignee_name} size="sm" />
                  <span className="truncate">{node.assignee_name}</span>
                </span>
              ) : (
                <span className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-warning px-2 text-xs font-medium text-warning">
                  <UserPlus aria-hidden className="size-3.5" />
                  Unassigned
                </span>
              )}
            </Row>
            {node.type !== "event" ? (
              <Row label="Due date">
                {node.due_at ? (
                  <span className="flex flex-col">
                    <span>{formatDateTime(node.due_at)}</span>
                    <RelativeTime iso={node.due_at} overdue={overdue} tooltip={false} className={overdue ? "text-xs" : "text-xs text-foreground-muted"} />
                  </span>
                ) : (
                  <span className="text-foreground-muted">No due date</span>
                )}
              </Row>
            ) : null}
            {isTask ? (
              <>
                <Row label="Status">{node.status ? <StatusBadge status={node.status} /> : null}</Row>
                <Row label="Priority">
                  <PriorityLabel priority={node.priority} />
                </Row>
              </>
            ) : null}
            {node.type !== "event" ? <Row label="Weight">{node.weight}</Row> : null}
          </dl>

          {summary ? (
            <section aria-labelledby="panel-progress" className="flex flex-col gap-2">
              <h3 id="panel-progress" className="text-sm font-semibold">
                Progress
              </h3>
              <ProgressBar value={node.progress} label={`${node.title} progress`} />
              <p className="text-sm text-foreground-muted">
                {summary.tasks === 0
                  ? "No tasks yet."
                  : `${summary.tasks} ${summary.tasks === 1 ? "task" : "tasks"}${summary.segments > 0 ? ` in ${summary.segments} ${summary.segments === 1 ? "segment" : "segments"}` : ""}`}
              </p>
              {summary.tasks > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground-muted">
                  {STATUS_ORDER.map((s) => (
                    <li key={s}>
                      {STATUS_LABELS[s]}: <span className="tabular-nums">{summary.byStatus[s]}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="panel-activity" className="flex flex-col gap-3">
            <h3 id="panel-activity" className="text-sm font-semibold">
              Activity
            </h3>
            <ActivityTimeline items={activity} />
          </section>

          {canComment(ctx, nodeCtx) ? (
            <section aria-labelledby="panel-composer" className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 id="panel-composer" className="text-sm font-semibold">
                Add a comment
              </h3>
              <CommentComposer nodeId={node.id} />
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
