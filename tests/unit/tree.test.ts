import { describe, expect, it } from "vitest";
import {
  ancestorIds,
  buildTree,
  defaultExpandedIds,
  filterTasks,
  flattenVisible,
  isOverdue,
  parseFilter,
  subtreeSize,
  toggleExpanded,
  walk,
  type FilterContext,
  type TreeRow,
} from "@/lib/tree";

function row(over: Partial<TreeRow> & Pick<TreeRow, "id" | "type" | "parent_id">): TreeRow {
  return {
    title: over.id,
    description: null,
    assignee_id: null,
    assignee_name: null,
    assignee_avatar: null,
    status: over.type === "task" ? "todo" : null,
    priority: "medium",
    due_at: null,
    weight: 1,
    position: 0,
    depth: 0,
    progress: 0,
    submitted_at: null,
    verified_at: null,
    ...over,
  };
}

// Tests may use `!` on values the fixture guarantees exist.
// Event
// |- Venue (seg, pos 1)
// |  |- Hall (seg)        depth 2
// |  |  `- Book hall (task, mine, submitted)  depth 3
// |  `- Chairs (task, overdue)                depth 2
// `- Publicity (seg, pos 0)
//    `- Poster (task, mine)                   depth 2
const ROWS: TreeRow[] = [
  row({ id: "e", type: "event", parent_id: null, title: "Tech Fest" }),
  row({ id: "venue", type: "segment", parent_id: "e", depth: 1, position: 1, title: "Venue" }),
  row({ id: "pub", type: "segment", parent_id: "e", depth: 1, position: 0, title: "Publicity" }),
  row({ id: "hall", type: "segment", parent_id: "venue", depth: 2, title: "Hall" }),
  row({ id: "chairs", type: "task", parent_id: "venue", depth: 2, position: 1, title: "Chairs", assignee_id: "u2", due_at: "2026-01-01T00:00:00Z" }),
  row({ id: "poster", type: "task", parent_id: "pub", depth: 2, title: "Poster", assignee_id: "u1" }),
  row({ id: "book", type: "task", parent_id: "hall", depth: 3, title: "Book hall", assignee_id: "u1", status: "submitted" }),
];
const ctx: FilterContext = { userId: "u1", eventStatus: "active", now: new Date("2026-06-01T00:00:00Z") };

describe("buildTree", () => {
  const root = buildTree(ROWS);

  it("nests rows under the event and sorts siblings by position", () => {
    expect(root?.id).toBe("e");
    expect(root?.children.map((c) => c.id)).toEqual(["pub", "venue"]);
    expect(root?.children[1]?.children.map((c) => c.id)).toEqual(["hall", "chairs"]);
  });

  it("keeps the incoming order for equal positions", () => {
    const tied = [
      row({ id: "e", type: "event", parent_id: null }),
      row({ id: "b", type: "task", parent_id: "e", depth: 1 }),
      row({ id: "a", type: "task", parent_id: "e", depth: 1 }),
    ];
    expect(buildTree(tied)?.children.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("returns null with no event row and ignores unreachable rows", () => {
    expect(buildTree([])).toBeNull();
    const withOrphan = [...ROWS, row({ id: "ghost", type: "task", parent_id: "nope", depth: 2 })];
    expect(walk(buildTree(withOrphan)!).map((n) => n.id)).not.toContain("ghost");
  });

  it("does not mutate the input rows", () => {
    expect("children" in (ROWS[0] as object)).toBe(false);
  });

  it("an event with no children is just the root", () => {
    const only = buildTree([row({ id: "e", type: "event", parent_id: null })]);
    expect(only?.children).toEqual([]);
  });

  it("handles a 6-deep tree", () => {
    const rows: TreeRow[] = [row({ id: "n0", type: "event", parent_id: null })];
    for (let d = 1; d <= 5; d++) rows.push(row({ id: `n${d}`, type: "segment", parent_id: `n${d - 1}`, depth: d }));
    rows.push(row({ id: "leaf", type: "task", parent_id: "n5", depth: 6 }));
    const tree = buildTree(rows)!;
    expect(walk(tree).map((n) => n.id)).toEqual(["n0", "n1", "n2", "n3", "n4", "n5", "leaf"]);
    expect(ancestorIds(tree, "leaf")).toEqual(["n0", "n1", "n2", "n3", "n4", "n5"]);
  });
});

describe("walk and subtreeSize", () => {
  const root = buildTree(ROWS)!;

  it("visits parents before children in sibling order", () => {
    expect(walk(root).map((n) => n.id)).toEqual(["e", "pub", "poster", "venue", "hall", "book", "chairs"]);
  });

  it("counts the node plus all descendants for delete confirmations", () => {
    expect(subtreeSize(root)).toBe(7);
    expect(subtreeSize(root.children[1]!)).toBe(4); // venue, hall, book, chairs
    expect(subtreeSize(root.children[0]!.children[0]!)).toBe(1); // a task
  });
});

describe("filters", () => {
  const root = buildTree(ROWS)!;

  it("parseFilter falls back to all", () => {
    expect(parseFilter("mine")).toBe("mine");
    expect(parseFilter("overdue")).toBe("overdue");
    expect(parseFilter("review")).toBe("review");
    expect(parseFilter("nope")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter(null)).toBe("all");
  });

  it("mine: my tasks in tree order, with segment breadcrumbs (no event root)", () => {
    const items = filterTasks(root, "mine", ctx);
    expect(items.map((i) => i.node.id)).toEqual(["poster", "book"]);
    expect(items[0]?.breadcrumb.map((b) => b.title)).toEqual(["Publicity"]);
    expect(items[1]?.breadcrumb.map((b) => b.title)).toEqual(["Venue", "Hall"]);
  });

  it("review: submitted tasks only", () => {
    expect(filterTasks(root, "review", ctx).map((i) => i.node.id)).toEqual(["book"]);
  });

  it("overdue: past due, not verified, event active (BR-09)", () => {
    expect(filterTasks(root, "overdue", ctx).map((i) => i.node.id)).toEqual(["chairs"]);
    expect(filterTasks(root, "overdue", { ...ctx, eventStatus: "draft" })).toEqual([]);
    expect(filterTasks(root, "overdue", { ...ctx, eventStatus: "completed" })).toEqual([]);
  });

  it("isOverdue edge cases", () => {
    const due = "2026-05-31T23:59:59Z";
    expect(isOverdue({ type: "task", status: "todo", due_at: due }, ctx)).toBe(true);
    expect(isOverdue({ type: "task", status: "verified", due_at: due }, ctx)).toBe(false);
    expect(isOverdue({ type: "task", status: "submitted", due_at: due }, ctx)).toBe(true);
    expect(isOverdue({ type: "task", status: "todo", due_at: null }, ctx)).toBe(false);
    expect(isOverdue({ type: "task", status: "todo", due_at: "2026-06-01T00:00:00Z" }, ctx)).toBe(false); // exactly now
    expect(isOverdue({ type: "segment", status: null, due_at: due }, ctx)).toBe(false);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterTasks(root, "mine", { ...ctx, userId: "nobody" })).toEqual([]);
  });
});

describe("expansion helpers", () => {
  const root = buildTree(ROWS)!;

  it("default: the root and first-level containers are open, tasks never", () => {
    expect([...defaultExpandedIds(root)].sort()).toEqual(["e", "pub", "venue"]);
    expect([...defaultExpandedIds(root, 2)].sort()).toEqual(["e", "hall", "pub", "venue"]);
  });

  it("toggleExpanded returns a new set", () => {
    const a = new Set(["e"]);
    const b = toggleExpanded(a, "venue");
    expect([...b].sort()).toEqual(["e", "venue"]);
    expect(a.has("venue")).toBe(false);
    expect(toggleExpanded(b, "venue").has("venue")).toBe(false);
  });

  it("flattenVisible shows children only under expanded nodes", () => {
    const rows = flattenVisible(root, new Set(["e", "venue"]));
    expect(rows.map((r) => [r.node.id, r.level])).toEqual([
      ["e", 0],
      ["pub", 1],
      ["venue", 1],
      ["hall", 2],
      ["chairs", 2],
    ]);
    expect(rows.find((r) => r.node.id === "pub")).toMatchObject({ hasChildren: true, expanded: false });
    expect(rows.find((r) => r.node.id === "chairs")).toMatchObject({ hasChildren: false });
  });

  it("ancestorIds reveals a deep node; unknown id gives nothing", () => {
    expect(ancestorIds(root, "book")).toEqual(["e", "venue", "hall"]);
    expect(ancestorIds(root, "e")).toEqual([]);
    expect(ancestorIds(root, "missing")).toEqual([]);
  });
});
