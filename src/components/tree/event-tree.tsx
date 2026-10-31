"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ComboboxOption } from "@/components/ui/combobox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { canCreateChild, isEventOwner, type EventContext } from "@/lib/permissions";
import { buildNodeContexts, filterTasks, parseFilter, type TreeFilter, type TreeNode } from "@/lib/tree";
import { NodeActions } from "./node-actions";
import { NodeFormDialog, type NodeDialogTarget } from "./node-form-dialog";
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
  root,
  ctx,
  members,
}: {
  root: TreeNode;
  ctx: EventContext; // who I am in this event, for the permission mirror
  members: ReadonlyArray<ComboboxOption>; // org members, for the assignee select
}) {
  const { eventStatus, userId } = ctx;
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

  const onOpenNode = useCallback((id: string) => go((q) => q.set("node", id)), [go]);
  const setFilter = useCallback(
    (value: TreeFilter) => go((q) => (value === "all" ? q.delete("filter") : q.set("filter", value))),
    [go],
  );

  const [dialog, setDialog] = useState<NodeDialogTarget | null>(null);
  const nodeContexts = useMemo(() => buildNodeContexts(root), [root]);

  const renderActions = useCallback(
    (node: TreeNode) => {
      const nodeCtx = nodeContexts.get(node.id);
      return nodeCtx ? <NodeActions node={node} ctx={ctx} nodeCtx={nodeCtx} onOpenDialog={setDialog} /> : null;
    },
    [nodeContexts, ctx],
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
          selectedId={params.get("node")}
          flatItems={items}
          onOpenNode={onOpenNode}
          renderActions={renderActions}
          renderEmpty={renderEmpty}
          className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        />
      )}
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
