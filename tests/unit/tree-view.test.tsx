import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TreeView } from "@/components/tree/tree-view";
import { treeKeyAction } from "@/components/tree/tree-keyboard";
import { parseStoredIds } from "@/components/tree/use-tree-expanded";
import { buildTree, flattenVisible, type TreeNode, type TreeRow } from "@/lib/tree";

const D = 24 * 3600_000;
let seq = 0;
const eventId = () => `ev-${++seq}`; // storage keys are per event, so tests do not share state

function row(id: string, parent: string | null, type: TreeRow["type"], over: Partial<TreeRow> = {}): TreeRow {
  return {
    id,
    parent_id: parent,
    type,
    title: id,
    description: null,
    assignee_id: "u1",
    assignee_name: "Rafi Islam",
    assignee_avatar: null,
    status: type === "task" ? "todo" : null,
    priority: "medium",
    due_at: null,
    weight: 1,
    position: 0,
    depth: parent === null ? 0 : type === "segment" ? 1 : 2,
    progress: 0,
    submitted_at: null,
    verified_at: null,
    ...over,
  };
}

// event -> venue (t1, t2) , publicity (t3) ; empty (no children)
function sample(): TreeNode {
  const root = buildTree([
    row("event", null, "event", { title: "Tech Fest", progress: 40 }),
    row("venue", "event", "segment", { position: 0, progress: 50 }),
    row("publicity", "event", "segment", { position: 1 }),
    row("empty", "event", "segment", { position: 2, assignee_id: null, assignee_name: null }),
    row("t1", "venue", "task", { position: 0, status: "in_progress" }),
    row("t2", "venue", "task", { position: 1, assignee_id: null, assignee_name: null }),
    row("t3", "publicity", "task", { position: 0, status: "submitted" }),
  ]);
  if (!root) throw new Error("no root");
  return root;
}

function renderTree(over: Partial<React.ComponentProps<typeof TreeView>> = {}) {
  const onOpenNode = vi.fn<(id: string) => void>();
  const props = {
    root: sample(),
    eventId: eventId(),
    eventStatus: "active" as const,
    ...over,
    onOpenNode,
  };
  return { ...render(<TreeView {...props} />), props };
}

const item = (name: string) => screen.getByRole("treeitem", { name: new RegExp(`^${name}`) });

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("treeKeyAction", () => {
  const rows = flattenVisible(sample(), new Set(["event", "venue"]));
  // event, venue, t1, t2, publicity, empty
  const at = (id: string) => rows.findIndex((r) => r.node.id === id);

  it("moves between visible rows and stops at the ends", () => {
    expect(treeKeyAction(rows, at("venue"), "ArrowDown")).toEqual({ type: "focus", id: "t1" });
    expect(treeKeyAction(rows, at("venue"), "ArrowUp")).toEqual({ type: "focus", id: "event" });
    expect(treeKeyAction(rows, 0, "ArrowUp")).toEqual({ type: "focus", id: "event" });
    expect(treeKeyAction(rows, rows.length - 1, "ArrowDown")).toEqual({ type: "focus", id: "empty" });
    expect(treeKeyAction(rows, 3, "Home")).toEqual({ type: "focus", id: "event" });
    expect(treeKeyAction(rows, 0, "End")).toEqual({ type: "focus", id: "empty" });
  });

  it("right expands a closed branch, then enters it; no-op on a leaf", () => {
    expect(treeKeyAction(rows, at("publicity"), "ArrowRight")).toEqual({ type: "toggle", id: "publicity", open: true });
    expect(treeKeyAction(rows, at("venue"), "ArrowRight")).toEqual({ type: "focus", id: "t1" });
    expect(treeKeyAction(rows, at("t1"), "ArrowRight")).toBeNull();
  });

  it("left collapses an open branch, otherwise goes to the parent", () => {
    expect(treeKeyAction(rows, at("venue"), "ArrowLeft")).toEqual({ type: "toggle", id: "venue", open: false });
    expect(treeKeyAction(rows, at("t1"), "ArrowLeft")).toEqual({ type: "focus", id: "venue" });
    expect(treeKeyAction(rows, at("event"), "ArrowLeft")).toEqual({ type: "toggle", id: "event", open: false });
    expect(treeKeyAction(flattenVisible(sample(), new Set()), 0, "ArrowLeft")).toBeNull();
  });

  it("Enter opens the detail, Space toggles expand, other keys do nothing", () => {
    expect(treeKeyAction(rows, at("t1"), "Enter")).toEqual({ type: "open", id: "t1" });
    expect(treeKeyAction(rows, at("venue"), " ")).toEqual({ type: "toggle", id: "venue", open: false });
    expect(treeKeyAction(rows, at("t1"), " ")).toBeNull();
    expect(treeKeyAction(rows, 0, "a")).toBeNull();
  });
});

describe("parseStoredIds", () => {
  it("accepts a string array and rejects anything else", () => {
    expect(parseStoredIds('["a","b"]')).toEqual(["a", "b"]);
    expect(parseStoredIds(null)).toBeNull();
    expect(parseStoredIds("{bad")).toBeNull();
    expect(parseStoredIds('{"a":1}')).toBeNull();
    expect(parseStoredIds("[1,2]")).toBeNull();
  });
});

describe("TreeView structure and ARIA", () => {
  it("is a tree of treeitems with level, expanded and selected state", () => {
    renderTree({ selectedId: "t1" });
    expect(screen.getByRole("tree", { name: "Tech Fest tasks" })).toBeInTheDocument();
    expect(item("Tech Fest")).toHaveAttribute("aria-level", "1");
    expect(item("venue")).toHaveAttribute("aria-level", "2");
    expect(item("t1")).toHaveAttribute("aria-level", "3");
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
    expect(item("t1")).not.toHaveAttribute("aria-expanded");
    expect(item("t1")).toHaveAttribute("aria-selected", "true");
    expect(item("t2")).toHaveAttribute("aria-selected", "false");
    expect(item("venue")).toHaveAttribute("aria-posinset", "1");
    expect(item("venue")).toHaveAttribute("aria-setsize", "3");
  });

  it("shows root and first-level containers open by default, with one tab stop", () => {
    renderTree();
    expect(screen.getAllByRole("treeitem")).toHaveLength(7);
    const stops = screen.getAllByRole("treeitem").filter((el) => el.tabIndex === 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(item("Tech Fest"));
  });

  it("shows assignee, an Unassigned chip, status, progress and the empty-segment row", () => {
    renderTree();
    expect(within(item("t1")).getAllByText("Rafi Islam").length).toBeGreaterThan(0);
    expect(within(item("t2")).getByText("Unassigned")).toBeInTheDocument();
    expect(within(item("t1")).getByText("In progress")).toBeInTheDocument();
    expect(within(item("venue")).getByRole("progressbar", { name: "venue progress" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("marks an overdue task in red with the overdue wording, only while the event is active", () => {
    const root = buildTree([
      row("event", null, "event"),
      row("s", "event", "segment"),
      row("late", "s", "task", { due_at: new Date(Date.now() - 3 * D - 3600_000).toISOString() }),
      row("done", "s", "task", { status: "verified", due_at: new Date(Date.now() - 3 * D).toISOString() }),
    ]);
    if (!root) throw new Error("no root");
    const { unmount } = renderTree({ root });
    expect(within(item("late")).getAllByText("3 days overdue")[0]).toHaveClass("text-danger");
    expect(within(item("done")).queryByText(/overdue/)).toBeNull();
    unmount();
    renderTree({ root, eventStatus: "draft" });
    expect(within(item("late")).queryByText(/overdue/)).toBeNull();
  });

  it("flags a row with a pending change as busy", () => {
    renderTree({ pendingIds: new Set(["t1"]) });
    expect(item("t1")).toHaveAttribute("aria-busy", "true");
    expect(item("t2")).not.toHaveAttribute("aria-busy");
  });

  it("renders titles as plain text", () => {
    const root = buildTree([row("event", null, "event", { title: "<img src=x onerror=alert(1)>" })]);
    if (!root) throw new Error("no root");
    const { container } = renderTree({ root });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
  });

  it("renders row actions from the slot without opening the node when they are clicked", () => {
    const { props } = renderTree({
      renderActions: (n) => <button type="button">Actions for {n.title}</button>,
    });
    fireEvent.click(screen.getByRole("button", { name: "Actions for t1" }));
    expect(props.onOpenNode).not.toHaveBeenCalled();
  });
});

describe("TreeView interaction", () => {
  it("clicking a row opens it; clicking the chevron only toggles", () => {
    const { props } = renderTree();
    fireEvent.click(item("t1"));
    expect(props.onOpenNode).toHaveBeenCalledWith("t1");
    props.onOpenNode.mockClear();

    const chevron = item("venue").querySelector("[data-row-control]");
    if (!chevron) throw new Error("no chevron");
    fireEvent.click(chevron);
    expect(props.onOpenNode).not.toHaveBeenCalled();
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /^t1/ })).toBeNull();
  });

  it("arrow keys move focus, left/right collapse and expand, Enter opens", () => {
    const { props } = renderTree();
    item("Tech Fest").focus();
    fireEvent.keyDown(item("Tech Fest"), { key: "ArrowDown" });
    expect(item("venue")).toHaveFocus();
    expect(item("venue").tabIndex).toBe(0);
    expect(item("Tech Fest").tabIndex).toBe(-1);

    fireEvent.keyDown(item("venue"), { key: "ArrowDown" });
    expect(item("t1")).toHaveFocus();
    fireEvent.keyDown(item("t1"), { key: "ArrowLeft" });
    expect(item("venue")).toHaveFocus();

    fireEvent.keyDown(item("venue"), { key: "ArrowLeft" });
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(item("venue"), { key: "ArrowRight" });
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(item("venue"), { key: " " });
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(item("venue"), { key: "Enter" });
    expect(props.onOpenNode).toHaveBeenCalledWith("venue");
    fireEvent.keyDown(item("venue"), { key: "End" });
    expect(item("empty")).toHaveFocus();
    fireEvent.keyDown(item("empty"), { key: "Home" });
    expect(item("Tech Fest")).toHaveFocus();
  });

  it("ignores keys that come from controls inside a row", () => {
    const { props } = renderTree({ renderActions: () => <button type="button">menu</button> });
    const button = screen.getAllByRole("button", { name: "menu" })[0];
    if (!button) throw new Error("no menu button");
    fireEvent.keyDown(button, { key: "Enter" });
    expect(props.onOpenNode).not.toHaveBeenCalled();
  });

  it("reveals a selected node inside a collapsed branch", () => {
    const id = eventId();
    window.localStorage.setItem(`et:tree-expanded:${id}`, JSON.stringify(["event"]));
    renderTree({ eventId: id, selectedId: "t1" });
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
    expect(item("t1")).toBeInTheDocument();
  });
});

describe("TreeView expand state persistence", () => {
  it("remembers collapsed rows per event across remounts", () => {
    const id = eventId();
    const first = renderTree({ eventId: id });
    fireEvent.keyDown(item("venue"), { key: "ArrowLeft", target: item("venue") });
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");
    expect(JSON.parse(window.localStorage.getItem(`et:tree-expanded:${id}`) ?? "[]")).not.toContain("venue");
    first.unmount();

    renderTree({ eventId: id });
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /^t1/ })).toBeNull();
  });

  it("does not share state between events", () => {
    const a = renderTree();
    fireEvent.keyDown(item("venue"), { key: "ArrowLeft" });
    a.unmount();
    renderTree(); // a different event id
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
  });

  it("falls back to defaults when the stored value is corrupt", () => {
    const id = eventId();
    window.localStorage.setItem(`et:tree-expanded:${id}`, "{not json");
    renderTree({ eventId: id });
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps working when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderTree();
    expect(item("venue")).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(item("venue"), { key: "ArrowLeft" });
    expect(item("venue")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("TreeView at scale", () => {
  it("renders 500 nodes and toggles a branch quickly", { timeout: 15_000 }, () => {
    const rows: TreeRow[] = [row("event", null, "event")];
    let n = 0;
    for (let s = 0; s < 10; s++) {
      rows.push(row(`seg${s}`, "event", "segment", { position: s }));
      for (let t = 0; t < 49; t++) {
        rows.push(row(`task${n++}`, `seg${s}`, "task", { position: t, status: "in_progress" }));
      }
    }
    const root = buildTree(rows);
    if (!root) throw new Error("no root");

    const started = performance.now();
    const { container } = renderTree({ root });
    // Plain DOM queries: role queries compute accessible names and would dominate the timing.
    const count = () => container.querySelectorAll('[role="treeitem"]').length;
    expect(count()).toBe(501);
    const seg0 = container.querySelector<HTMLElement>('[data-node-id="seg0"]');
    if (!seg0) throw new Error("no seg0");
    fireEvent.keyDown(seg0, { key: "ArrowLeft" });
    const elapsed = performance.now() - started;
    expect(count()).toBe(501 - 49);
    // Generous ceiling for CI machines: a real regression is orders of magnitude slower.
    expect(elapsed).toBeLessThan(8000);
  });
});
