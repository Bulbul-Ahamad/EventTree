"use client";

import { CalendarDays, ChevronRight, Folder, ListChecks, Loader2, UserPlus } from "lucide-react";
import { memo, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type Ref } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { clampPercent, ProgressBar } from "@/components/ui/progress-bar";
import { RelativeTime } from "@/components/ui/relative-time";
import type { TreeNode } from "@/lib/tree";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.6. One row of the tree: [indent][chevron][type icon][title]
// [assignee][right meta][actions]. Below md: avatar only, due date under the title.

const TYPE_ICON = { event: CalendarDays, segment: Folder, task: ListChecks } as const;

export type TreeNodeRowProps = {
  node: TreeNode;
  level: number; // 0 = event root
  hasChildren: boolean;
  expanded: boolean;
  selected: boolean;
  tabbable: boolean;
  pending: boolean;
  overdue: boolean;
  posInSet: number;
  setSize: number;
  rowRef: Ref<HTMLDivElement>;
  actions?: (node: TreeNode) => ReactNode;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onFocusRow: (id: string) => void;
  onKey: (e: KeyboardEvent<HTMLDivElement>, id: string) => void;
};

function Assignee({ node }: { node: TreeNode }) {
  if (node.assignee_id === null) {
    return (
      <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-dashed border-warning px-2 text-xs font-medium text-warning">
        <UserPlus aria-hidden className="size-3.5" />
        <span className="sr-only md:not-sr-only">Unassigned</span>
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-2">
      <Avatar id={node.assignee_id} name={node.assignee_name} size="sm" />
      <span className="hidden max-w-32 truncate text-sm text-foreground-muted md:inline">{node.assignee_name}</span>
      <span className="sr-only md:hidden">{node.assignee_name}</span>
    </span>
  );
}

function RightMeta({ node, overdue, pending }: { node: TreeNode; overdue: boolean; pending: boolean }) {
  if (node.type === "task") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {node.due_at ? (
          <RelativeTime
            iso={node.due_at}
            overdue={overdue}
            tooltip={false}
            className={cn("hidden text-xs md:inline-flex", !overdue && "text-foreground-muted")}
          />
        ) : null}
        {node.status ? <StatusBadge status={node.status} /> : null}
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-foreground-muted" /> : null}
      </span>
    );
  }
  const pct = clampPercent(node.progress);
  return (
    <span className="flex shrink-0 items-center gap-2">
      <ProgressBar value={node.progress} label={`${node.title} progress`} className="hidden w-44 md:flex" />
      <span className="text-xs tabular-nums text-foreground-muted md:hidden">
        {pct}%<span className="sr-only"> complete</span>
      </span>
      {pending ? <Loader2 aria-hidden className="size-4 animate-spin text-foreground-muted" /> : null}
    </span>
  );
}

function TreeNodeRowImpl(p: TreeNodeRowProps) {
  const { node, level, hasChildren, expanded, selected, pending, overdue } = p;
  const TypeIcon = TYPE_ICON[node.type];

  function onClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as Element).closest("[data-row-control]")) return;
    p.onOpen(node.id);
  }

  return (
    <div
      ref={p.rowRef}
      role="treeitem"
      aria-level={level + 1}
      aria-posinset={p.posInSet}
      aria-setsize={p.setSize}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={selected}
      aria-busy={pending || undefined}
      tabIndex={p.tabbable ? 0 : -1}
      data-own-focus
      data-node-id={node.id}
      style={{ "--lvl": level } as CSSProperties}
      onClick={onClick}
      onFocus={(e) => {
        if (e.target === e.currentTarget) p.onFocusRow(node.id);
      }}
      onKeyDown={(e) => p.onKey(e, node.id)}
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 border-l-2 border-transparent py-1 pr-2 pl-[calc(var(--lvl)*1.25rem+0.5rem)] transition-colors duration-150 hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected && "border-primary bg-primary-soft hover:bg-primary-soft",
        pending && "opacity-60",
      )}
    >
      {hasChildren ? (
        <span
          data-row-control
          aria-hidden
          onClick={() => p.onToggle(node.id)}
          className="grid size-5 shrink-0 place-items-center rounded-sm text-foreground-muted hover:bg-border"
        >
          <ChevronRight className={cn("size-4 transition-transform duration-150", expanded && "rotate-90")} />
        </span>
      ) : (
        <span aria-hidden className="size-5 shrink-0" />
      )}
      <TypeIcon aria-hidden className="size-5 shrink-0 text-foreground-muted" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", node.type !== "task" && "font-semibold")}>{node.title}</span>
        {node.type === "task" && node.due_at ? (
          <RelativeTime
            iso={node.due_at}
            overdue={overdue}
            tooltip={false}
            className={cn("text-xs md:hidden", !overdue && "text-foreground-muted")}
          />
        ) : null}
      </span>
      <Assignee node={node} />
      <RightMeta node={node} overdue={overdue} pending={pending} />
      {p.actions ? (
        <span data-row-control className="shrink-0">
          {p.actions(node)}
        </span>
      ) : null}
    </div>
  );
}

// Memoised: with 500 rows, toggling one branch must not re-render the others.
export const TreeNodeRow = memo(TreeNodeRowImpl);
