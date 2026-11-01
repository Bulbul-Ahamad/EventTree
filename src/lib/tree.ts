import type { EventStatus, NodeContext, NodeType, TaskStatus } from "@/lib/permissions";
import { taskProgress, weightedProgress } from "@/lib/progress";

// Flat rows (from the get_event_tree RPC) -> nested tree, plus filters and
// expansion helpers for the tree view. Pure functions.

export type TreeRow = {
  id: string;
  parent_id: string | null;
  type: NodeType;
  title: string;
  description: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  status: TaskStatus | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_at: string | null;
  weight: number;
  position: number;
  depth: number;
  progress: number;
  submitted_at: string | null;
  verified_at: string | null;
};

export type TreeNode = TreeRow & { children: TreeNode[] };

// Nests rows under their parents. Siblings are sorted by `position`; ties keep
// the order the RPC returned (it orders by depth, position, created_at).
// Returns the event root, or null when the list has no event row. Rows whose
// parent is not in the list are dropped (they cannot be reached from the root).
export function buildTree(rows: readonly TreeRow[]): TreeNode | null {
  const byId = new Map<string, TreeNode>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });

  let root: TreeNode | null = null;
  for (const node of byId.values()) {
    if (node.parent_id === null) {
      if (node.type === "event" && root === null) root = node;
      continue;
    }
    byId.get(node.parent_id)?.children.push(node);
  }
  for (const node of byId.values()) {
    node.children.sort((a, b) => a.position - b.position); // stable
  }
  return root;
}

// Depth-first, parent before children, siblings in order.
export function walk(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const visit = (n: TreeNode) => {
    out.push(n);
    n.children.forEach(visit);
  };
  visit(root);
  return out;
}

// Number of nodes a delete would remove: the node and all descendants (US-15 AC1).
export function subtreeSize(node: TreeNode): number {
  return 1 + node.children.reduce((sum, c) => sum + subtreeSize(c), 0);
}

// ---- filters ---------------------------------------------------------------

export const TREE_FILTERS = ["all", "mine", "overdue", "review"] as const;
export type TreeFilter = (typeof TREE_FILTERS)[number];

export function parseFilter(value: string | null | undefined): TreeFilter {
  return (TREE_FILTERS as readonly string[]).includes(value ?? "") ? (value as TreeFilter) : "all";
}

export type FilterContext = {
  userId: string;
  eventStatus: EventStatus;
  now: Date;
};

// BR-09: overdue = due in the past, not verified, and the event is active.
export function isOverdue(row: Pick<TreeRow, "type" | "status" | "due_at">, ctx: FilterContext): boolean {
  if (row.type !== "task" || row.status === null || row.status === "verified") return false;
  if (ctx.eventStatus !== "active" || row.due_at === null) return false;
  return new Date(row.due_at).getTime() < ctx.now.getTime();
}

export type FilteredItem = {
  node: TreeNode;
  // Ancestor segments from the top, without the event root (its title is the page title).
  breadcrumb: { id: string; title: string }[];
};

// Mine / Overdue / Needs review: matching tasks in tree order, each with its
// ancestor chain as a breadcrumb (02_AppFlow S11). `all` is not handled here:
// show the full tree.
export function filterTasks(
  root: TreeNode,
  filter: Exclude<TreeFilter, "all">,
  ctx: FilterContext,
): FilteredItem[] {
  const matches = (n: TreeNode): boolean => {
    if (n.type !== "task") return false;
    if (filter === "mine") return n.assignee_id === ctx.userId;
    if (filter === "overdue") return isOverdue(n, ctx);
    return n.status === "submitted"; // review
  };

  const out: FilteredItem[] = [];
  const visit = (n: TreeNode, trail: { id: string; title: string }[]) => {
    if (matches(n)) out.push({ node: n, breadcrumb: trail });
    const next = n.type === "segment" ? [...trail, { id: n.id, title: n.title }] : trail;
    n.children.forEach((c) => visit(c, next));
  };
  visit(root, []);
  return out;
}

// ---- expansion -------------------------------------------------------------

// Initially expanded: the root and every container down to `maxDepth`.
export function defaultExpandedIds(root: TreeNode, maxDepth = 1): Set<string> {
  const ids = new Set<string>();
  for (const n of walk(root)) {
    if (n.type !== "task" && n.depth <= maxDepth) ids.add(n.id);
  }
  return ids;
}

export function toggleExpanded(expanded: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Ids of all proper ancestors of a node, root first (to reveal a ?node= target).
export function ancestorIds(root: TreeNode, id: string): string[] {
  const path: string[] = [];
  const find = (n: TreeNode): boolean => {
    if (n.id === id) return true;
    path.push(n.id);
    if (n.children.some(find)) return true;
    path.pop();
    return false;
  };
  return find(root) ? path : [];
}

export type VisibleRow = { node: TreeNode; level: number; hasChildren: boolean; expanded: boolean };

// The rows to render now: a node's children appear only when it is expanded.
export function flattenVisible(root: TreeNode, expanded: ReadonlySet<string>): VisibleRow[] {
  const out: VisibleRow[] = [];
  const visit = (n: TreeNode, level: number) => {
    const isOpen = expanded.has(n.id);
    out.push({ node: n, level, hasChildren: n.children.length > 0, expanded: isOpen });
    if (isOpen) n.children.forEach((c) => visit(c, level + 1));
  };
  visit(root, 0);
  return out;
}

// ---- permissions ----------------------------------------------------------

// NodeContext (lib/permissions.ts) for every node, built in one pass: the
// assignees of all proper ancestors, event first.
export function buildNodeContexts(root: TreeNode): Map<string, NodeContext> {
  const map = new Map<string, NodeContext>();
  const visit = (n: TreeNode, trail: ReadonlyArray<string | null>) => {
    map.set(n.id, { type: n.type, assigneeId: n.assignee_id, ancestorAssigneeIds: trail });
    const next = [...trail, n.assignee_id];
    n.children.forEach((c) => visit(c, next));
  };
  visit(root, []);
  return map;
}

// ---- detail panel ---------------------------------------------------------

// Proper ancestors of a node, event first, as nodes (for the breadcrumb).
export function breadcrumbOf(root: TreeNode, id: string): TreeNode[] {
  const byId = new Map(walk(root).map((n) => [n.id, n]));
  return ancestorIds(root, id).flatMap((a) => {
    const n = byId.get(a);
    return n ? [n] : [];
  });
}

export type SubtreeSummary = {
  segments: number; // segments below the node
  tasks: number; // tasks below the node
  byStatus: Record<TaskStatus, number>;
};

// Counts below a node (not the node itself): what a segment or event contains.
export function subtreeSummary(node: TreeNode): SubtreeSummary {
  const out: SubtreeSummary = {
    segments: 0,
    tasks: 0,
    byStatus: { todo: 0, in_progress: 0, submitted: 0, verified: 0 },
  };
  for (const n of walk(node)) {
    if (n.id === node.id) continue;
    if (n.type === "segment") out.segments += 1;
    if (n.type === "task") {
      out.tasks += 1;
      if (n.status) out.byStatus[n.status] += 1;
    }
  }
  return out;
}

// ---- optimistic updates ---------------------------------------------------

// A copy of the tree where one task has another status. Only the nodes on the
// path to it are copied, so unchanged rows keep their identity (memoised rows
// do not re-render). Used by useOptimistic for status buttons.
export function withTaskStatus(root: TreeNode, id: string, status: TaskStatus): TreeNode {
  const visit = (n: TreeNode): TreeNode => {
    if (n.id === id) return { ...n, status };
    let changed = false;
    const children = n.children.map((c) => {
      const next = visit(c);
      if (next !== c) changed = true;
      return next;
    });
    return changed ? { ...n, children } : n;
  };
  return visit(root);
}

// A copy of the tree without one node and everything under it. Progress of the
// ancestors is worked out again with the same roll-up as the database (BR-06),
// so a parent shows its new percentage at once. The event root cannot be removed.
export function withoutNode(root: TreeNode, id: string): TreeNode {
  if (root.id === id) return root;
  const visit = (n: TreeNode): { node: TreeNode; changed: boolean } => {
    let changed = false;
    const children: TreeNode[] = [];
    for (const c of n.children) {
      if (c.id === id) {
        changed = true;
        continue;
      }
      const r = visit(c);
      if (r.changed) changed = true;
      children.push(r.node);
    }
    if (!changed) return { node: n, changed: false };
    const progress = weightedProgress(
      children.map((c) => ({ progress: c.type === "task" ? taskProgress(c.status) : c.progress, weight: c.weight })),
    );
    return { node: { ...n, children, progress }, changed: true };
  };
  return visit(root).node;
}

// What a delete takes with it: the node itself plus everything below.
export type DeleteImpact = { segments: number; tasks: number; total: number };

export function deleteImpact(node: TreeNode): DeleteImpact {
  let segments = 0;
  let tasks = 0;
  for (const n of walk(node)) {
    if (n.type === "segment") segments += 1;
    if (n.type === "task") tasks += 1;
  }
  return { segments, tasks, total: segments + tasks };
}

export function isInSubtree(node: TreeNode, id: string): boolean {
  return walk(node).some((n) => n.id === id);
}
