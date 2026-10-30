import type { EventStatus, NodeType, TaskStatus } from "@/lib/permissions";

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
