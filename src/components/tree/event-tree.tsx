"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ActivityItem } from "@/features/updates/queries";
import { errorMessage } from "@/lib/errors";
import { canCreateChild, isEventOwner, type EventContext, type TaskStatus } from "@/lib/permissions";
import type { Transition } from "@/lib/status";
import { notify } from "@/lib/toast";
import { buildNodeContexts, filterTasks, isOverdue, parseFilter, walk, withTaskStatus, type TreeFilter, type TreeNode } from "@/lib/tree";
import { NodeActions } from "./node-actions";
import { NodeDetailPanel } from "./node-detail-panel";
import { NodeFormDialog, type NodeDialogTarget } from "./node-form-dialog";
import { TransitionCommentDialog } from "./transition-comment-dialog";
import { useTaskTransitions } from "./use-task-transitions";
import { TreeView } from "./tree-view";

const FILTER_OPTIONS: ReadonlyArray<{ value: TreeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "overdue", label: "Overdue" },
  { value: "review", label: "Needs review" },
];

// The tree wired to the URL (02_AppFlow S11): the selected row is `?node=<id>`
// (S12 reads the same parameter) and the filter is `?filter=`.
export function EventTree({
  root: serverRoot,
  ctx,
  members,
  activity,
  activityFor,
}: {
  root: TreeNode;
  ctx: EventContext; // who I am in this event, for the permission mirror
  members: ReadonlyArray<ComboboxOption>; // org members, for the assignee select
  activity: ActivityItem[]; // activity of the node named by `activityFor`
  activityFor: string | null;
}) {
  const { eventStatus, userId } = ctx;
  // Status changes show at once and roll back by themselves if the request fails.
  const [root, applyOptimistic] = useOptimistic(serverRoot, (current: TreeNode, change: { id: string; status: TaskStatus }) =>
    withTaskStatus(current, change.id, change.status),
  );
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilter(params.get("filter"));

  const go = useCallback(
    (change: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      change(next);
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const selectedId = params.get("node");
  const nodeById = useMemo(() => new Map(walk(root).map((n) => [n.id, n])), [root]);
  const selectedNode = selectedId ? (nodeById.get(selectedId) ?? null) : null;

  // A ?node= that does not exist (or I cannot see): drop it and say so (S12).
  useEffect(() => {
    if (selectedId && !nodeById.has(selectedId)) {
      notify.error(errorMessage("E_NOT_FOUND"));
      go((q) => q.delete("node"));
    }
  }, [selectedId, nodeById, go]);

  const onOpenNode = useCallback((id: string) => go((q) => q.set("node", id)), [go]);
  const setFilter = useCallback(
    (value: TreeFilter) => go((q) => (value === "all" ? q.delete("filter") : q.set("filter", value))),
    [go],
  );

  const [dialog, setDialog] = useState<NodeDialogTarget | null>(null);
  const nodeContexts = useMemo(() => buildNodeContexts(serverRoot), [serverRoot]);
  const tx = useTaskTransitions({ ctx, nodeContexts, apply: applyOptimistic });
  const { transitionsFor, run: runTransition } = tx;
  const [commentFor, setCommentFor] = useState<{ node: TreeNode; transition: Transition } | null>(null);

  const renderActions = useCallback(
    (node: TreeNode) => {
      const nodeCtx = nodeContexts.get(node.id);
      if (!nodeCtx) return null;
      return (
        <NodeActions
          node={node}
          ctx={ctx}
          nodeCtx={nodeCtx}
          onOpenDialog={setDialog}
          transitions={transitionsFor(node)}
          onTransition={(t) => (t.commentRequired ? setCommentFor({ node, transition: t }) : runTransition(node, t))}
        />
      );
    },
    [nodeContexts, ctx, transitionsFor, runTransition],
  );

  // Empty containers: a short note, with an add button for those who may add.
  const renderEmpty = useCallback(
    (node: TreeNode) => {
      const nodeCtx = nodeContexts.get(node.id);
      const canAdd = nodeCtx ? canCreateChild(ctx, nodeCtx) : false;
      if (node.type === "event") {
        return isEventOwner(ctx) && canAdd ? (
          <>
            Start by adding your first segment
            <Button size="sm" onClick={() => setDialog({ kind: "create", parent: node, type: "segment" })}>
              Add segment
            </Button>
          </>
        ) : (
          "The owner hasn't added any segments yet."
        );
      }
      return (
        <>
          No tasks yet
          {canAdd ? (
            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "create", parent: node, type: "task" })}>
              Add task
            </Button>
          ) : null}
        </>
      );
    },
    [nodeContexts, ctx],
  );

  const items = useMemo(
    () => (filter === "all" ? undefined : filterTasks(root, filter, { userId, eventStatus, now: new Date() })),
    [filter, root, userId, eventStatus],
  );

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label="Filter tasks"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        className="self-start"
      />
      {items && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <EmptyState
            icon={SearchX}
            title="No tasks match this filter."
            action={
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Clear filter
              </Button>
            }
          />
        </div>
      ) : (
        <TreeView
          root={root}
          eventId={root.id}
          eventStatus={eventStatus}
          selectedId={selectedId}
          flatItems={items}
          onOpenNode={onOpenNode}
          pendingIds={tx.pendingIds}
          renderActions={renderActions}
          renderEmpty={renderEmpty}
          className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        />
      )}
      {selectedNode && nodeContexts.get(selectedNode.id) ? (
        <NodeDetailPanel
          root={root}
          node={selectedNode}
          ctx={ctx}
          nodeCtx={nodeContexts.get(selectedNode.id)!} // checked just above
          activity={activityFor === selectedNode.id ? activity : null}
          transitions={tx.transitionsFor(selectedNode)}
          transitionPending={tx.pendingIds.has(selectedNode.id)}
          transitionError={tx.error?.nodeId === selectedNode.id ? tx.error.message : null}
          onTransition={(t, comment) => tx.run(selectedNode, t, { inline: true, ...(comment !== undefined ? { comment } : {}) })}
          overdue={isOverdue(selectedNode, { userId, eventStatus, now: new Date() })}
          onNavigate={onOpenNode}
          onClose={() => go((q) => q.delete("node"))}
        />
      ) : null}
      {commentFor ? (
        <TransitionCommentDialog
          taskTitle={commentFor.node.title}
          transition={commentFor.transition}
          pending={tx.pendingIds.has(commentFor.node.id)}
          error={tx.error?.nodeId === commentFor.node.id ? tx.error.message : null}
          onConfirm={(comment) =>
            tx.run(commentFor.node, commentFor.transition, { comment, inline: true, onSuccess: () => setCommentFor(null) })
          }
          onClose={() => {
            tx.clearError();
            setCommentFor(null);
          }}
        />
      ) : null}
      {dialog ? (
        <NodeFormDialog
          key={dialog.kind === "create" ? `create-${dialog.parent.id}-${dialog.type}` : `${dialog.kind}-${dialog.node.id}`}
          target={dialog}
          members={members}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
