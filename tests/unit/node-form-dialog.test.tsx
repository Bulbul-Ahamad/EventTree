import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NodeActions } from "@/components/tree/node-actions";
import { NodeFormDialog, type NodeDialogTarget } from "@/components/tree/node-form-dialog";
import { fail, ok } from "@/lib/action-result";
import { ERROR_MESSAGES, type ErrorCode } from "@/lib/errors";
import { isoToLocalInput } from "@/lib/format-date";
import type { EventContext } from "@/lib/permissions";
import { buildNodeContexts, buildTree, type TreeNode, type TreeRow } from "@/lib/tree";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const createNode = vi.fn();
const updateNode = vi.fn();
const reassignNode = vi.fn();
vi.mock("@/features/nodes/actions", () => ({
  createNode: (i: unknown) => createNode(i),
  updateNode: (i: unknown) => updateNode(i),
  reassignNode: (i: unknown) => reassignNode(i),
}));
const success = vi.fn();
vi.mock("@/lib/toast", () => ({ notify: { success: (m: string) => success(m), error: vi.fn() } }));

function row(id: string, parent: string | null, type: TreeRow["type"], over: Partial<TreeRow> = {}): TreeRow {
  return {
    id, parent_id: parent, type, title: id, description: null, assignee_id: null, assignee_name: null,
    assignee_avatar: null, status: type === "task" ? "todo" : null, priority: "medium", due_at: null, weight: 1,
    position: 0, depth: parent === null ? 0 : type === "segment" ? 1 : 2, progress: 0, submitted_at: null,
    verified_at: null, ...over,
  };
}

// event (owner u-owner) -> venue (head u-head) -> task (assignee u-nila)
function tree(): TreeNode {
  const root = buildTree([
    row("event", null, "event", { title: "Tech Fest", assignee_id: "u-owner" }),
    row("venue", "event", "segment", { title: "Venue", assignee_id: "u-head" }),
    row("task", "venue", "task", {
      title: "Stage", description: "Build it", assignee_id: "u-nila", priority: "high", weight: 3,
      due_at: "2026-11-05T10:00:00.000Z",
    }),
  ]);
  if (!root) throw new Error("no root");
  return root;
}
const find = (root: TreeNode, id: string): TreeNode => {
  const hit = [root, ...root.children, ...root.children.flatMap((c) => c.children)].find((n) => n.id === id);
  if (!hit) throw new Error(id);
  return hit;
};

const MEMBERS = [
  { value: "u-nila", label: "Nila Akter", description: "nila@demo.test" },
  { value: "u-rafi", label: "Rafi Islam", description: "rafi@demo.test" },
];

function dialog(target: NodeDialogTarget) {
  const onClose = vi.fn();
  render(<NodeFormDialog target={target} members={MEMBERS} onClose={onClose} />);
  return { onClose };
}
const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
async function pickAssignee(name: string) {
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(name) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isoToLocalInput", () => {
  it("round-trips with the datetime-local format and handles empty values", () => {
    const iso = "2026-11-05T10:00:00.000Z";
    const local = isoToLocalInput(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(local).toISOString()).toBe(iso);
    expect(isoToLocalInput(null)).toBe("");
    expect(isoToLocalInput("nonsense")).toBe("");
  });
});

describe("NodeFormDialog: add", () => {
  it("adds a segment: no priority field, sends the entered values, toasts and refreshes", async () => {
    createNode.mockResolvedValue(ok({ nodeId: "n1" }));
    const root = tree();
    const { onClose } = dialog({ kind: "create", parent: root, type: "segment" });
    expect(screen.getByRole("heading", { name: "Add segment" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Priority")).toBeNull();

    type(/^Title/, "Publicity");
    submit("Add segment");
    await waitFor(() =>
      expect(createNode).toHaveBeenCalledWith({
        parentId: "event", type: "segment", title: "Publicity", description: "", assigneeId: null, dueAt: null, weight: 1,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(success).toHaveBeenCalledWith("Segment added");
    expect(refresh).toHaveBeenCalled();
  });

  it("adds a task with assignee, priority, weight and due date", async () => {
    createNode.mockResolvedValue(ok({ nodeId: "n2" }));
    const root = tree();
    dialog({ kind: "create", parent: find(root, "venue"), type: "task" });
    type(/^Title/, "Sound check");
    await pickAssignee("Rafi Islam");
    type("Priority", "urgent");
    type(/^Weight/, "4");
    type("Due date", "2026-11-05T10:00");
    submit("Add task");
    await waitFor(() => expect(createNode).toHaveBeenCalled());
    expect(createNode.mock.calls[0]?.[0]).toMatchObject({
      parentId: "venue", type: "task", title: "Sound check", assigneeId: "u-rafi", priority: "urgent", weight: 4,
      dueAt: new Date("2026-11-05T10:00").toISOString(),
    });
  });

  it("shows field errors and does not call the action", () => {
    dialog({ kind: "create", parent: tree(), type: "task" });
    type(/^Weight/, "11");
    submit("Add task");
    expect(screen.getByText("Enter a title.")).toBeInTheDocument();
    expect(screen.getByText("Use a number from 1 to 10.")).toBeInTheDocument();
    expect(createNode).not.toHaveBeenCalled();
  });

  it("treats an empty weight as an error, not as zero", () => {
    dialog({ kind: "create", parent: tree(), type: "task" });
    type(/^Title/, "x");
    type(/^Weight/, "");
    submit("Add task");
    expect(screen.getByText("Use a number from 1 to 10.")).toBeInTheDocument();
    expect(createNode).not.toHaveBeenCalled();
  });

  it("refuses a half-filled due date", () => {
    dialog({ kind: "create", parent: tree(), type: "task" });
    type(/^Title/, "x");
    const due = screen.getByLabelText("Due date");
    Object.defineProperty(due, "validity", { value: { badInput: true }, configurable: true });
    submit("Add task");
    expect(screen.getByText("Enter a complete date and time.")).toBeInTheDocument();
    expect(createNode).not.toHaveBeenCalled();
  });
});

describe("NodeFormDialog: error codes", () => {
  const FORM_LEVEL: ErrorCode[] = ["E_MAX_DEPTH", "E_NODE_LIMIT", "E_EVENT_READONLY", "E_NOT_AUTHORIZED", "E_NOT_FOUND", "E_PARENT_IS_TASK"];

  it.each(FORM_LEVEL)("shows the catalogue message for %s", async (code) => {
    createNode.mockResolvedValue(fail(code));
    dialog({ kind: "create", parent: tree(), type: "task" });
    type(/^Title/, "x");
    submit("Add task");
    expect(await screen.findByRole("alert")).toHaveTextContent(ERROR_MESSAGES[code]);
  });

  it("shows E_ASSIGNEE_NOT_IN_ORG on the assignee field", async () => {
    createNode.mockResolvedValue(fail("E_ASSIGNEE_NOT_IN_ORG"));
    dialog({ kind: "create", parent: tree(), type: "task" });
    type(/^Title/, "x");
    submit("Add task");
    expect(await screen.findByText(ERROR_MESSAGES.E_ASSIGNEE_NOT_IN_ORG)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the dialog open after an error", async () => {
    createNode.mockResolvedValue(fail("E_MAX_DEPTH"));
    const { onClose } = dialog({ kind: "create", parent: tree(), type: "segment" });
    type(/^Title/, "x");
    submit("Add segment");
    await screen.findByRole("alert");
    expect(onClose).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
});

describe("NodeFormDialog: edit", () => {
  it("starts from the current values", () => {
    dialog({ kind: "edit", node: find(tree(), "task") });
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Stage");
    expect(screen.getByLabelText("Description")).toHaveValue("Build it");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.getByLabelText(/^Weight/)).toHaveValue(3);
    expect(screen.getByLabelText("Due date")).toHaveValue(isoToLocalInput("2026-11-05T10:00:00.000Z"));
    expect(screen.getByRole("combobox")).toHaveTextContent("Nila Akter");
  });

  it("sends only the fields that changed and does not reassign", async () => {
    updateNode.mockResolvedValue(ok());
    const { onClose } = dialog({ kind: "edit", node: find(tree(), "task") });
    type(/^Title/, "Stage decoration");
    submit("Save");
    await waitFor(() => expect(updateNode).toHaveBeenCalledWith({ nodeId: "task", title: "Stage decoration" }));
    expect(reassignNode).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(success).toHaveBeenCalledWith("Changes saved");
  });

  it("clears the description and due date by sending null", async () => {
    updateNode.mockResolvedValue(ok());
    dialog({ kind: "edit", node: find(tree(), "task") });
    type("Description", "");
    type("Due date", "");
    submit("Save");
    await waitFor(() => expect(updateNode).toHaveBeenCalledWith({ nodeId: "task", description: "", dueAt: null }));
  });

  it("closes without calling anything when nothing changed", () => {
    const { onClose } = dialog({ kind: "edit", node: find(tree(), "task") });
    submit("Save");
    expect(onClose).toHaveBeenCalled();
    expect(updateNode).not.toHaveBeenCalled();
    expect(reassignNode).not.toHaveBeenCalled();
  });

  it("also reassigns when the assignee changed, after saving the other fields", async () => {
    updateNode.mockResolvedValue(ok());
    reassignNode.mockResolvedValue(ok());
    dialog({ kind: "edit", node: find(tree(), "task") });
    type(/^Title/, "New name");
    await pickAssignee("Rafi Islam");
    submit("Save");
    await waitFor(() => expect(reassignNode).toHaveBeenCalledWith({ nodeId: "task", assigneeId: "u-rafi" }));
    expect(updateNode).toHaveBeenCalledWith({ nodeId: "task", title: "New name" });
  });

  it("reports a failed reassignment and still refreshes because the other changes were saved", async () => {
    updateNode.mockResolvedValue(ok());
    reassignNode.mockResolvedValue(fail("E_ASSIGNEE_NOT_IN_ORG"));
    dialog({ kind: "edit", node: find(tree(), "task") });
    type(/^Title/, "New name");
    await pickAssignee("Rafi Islam");
    submit("Save");
    expect(await screen.findByText(ERROR_MESSAGES.E_ASSIGNEE_NOT_IN_ORG)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows no priority field when editing a segment", () => {
    dialog({ kind: "edit", node: find(tree(), "venue") });
    expect(screen.queryByLabelText("Priority")).toBeNull();
  });
});

describe("NodeFormDialog: reassign", () => {
  it("shows only the assignee and can set it to Unassigned", async () => {
    reassignNode.mockResolvedValue(ok());
    dialog({ kind: "reassign", node: find(tree(), "task") });
    expect(screen.queryByLabelText(/^Title/)).toBeNull();
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Unassigned" }));
    submit("Save");
    await waitFor(() => expect(reassignNode).toHaveBeenCalledWith({ nodeId: "task", assigneeId: null }));
    expect(success).toHaveBeenCalledWith("Assignee updated");
  });
});

describe("NodeActions (permission-gated row menu)", () => {
  function ctx(userId: string, over: Partial<EventContext> = {}): EventContext {
    return {
      userId, ownerId: "u-owner", eventStatus: "active", reviewMode: "assignee_submits", isOrgAdmin: false,
      isParticipant: true, ...over,
    };
  }
  async function menuFor(id: string, c: EventContext): Promise<string[] | null> {
    const root = tree();
    const nodeCtx = buildNodeContexts(root).get(id);
    if (!nodeCtx) throw new Error(id);
    const { container, unmount } = render(
      <NodeActions node={find(root, id)} ctx={c} nodeCtx={nodeCtx} onOpenDialog={vi.fn()} />,
    );
    const trigger = within(container).queryByRole("button");
    if (!trigger) {
      unmount();
      return null;
    }
    fireEvent.keyDown(trigger, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent?.trim() ?? "");
    unmount();
    return items;
  }

  it("owner: add on the root, everything on a segment", async () => {
    expect(await menuFor("event", ctx("u-owner"))).toEqual(["Add segment", "Add task"]);
    expect(await menuFor("venue", ctx("u-owner"))).toEqual(["Add segment", "Add task", "Edit", "Reassign"]);
  });

  it("head: add under own segment, edit and reassign below it, nothing on the root", async () => {
    expect(await menuFor("venue", ctx("u-head"))).toEqual(["Add segment", "Add task", "Edit", "Reassign"].slice(0, 2));
    expect(await menuFor("task", ctx("u-head"))).toEqual(["Edit", "Reassign"]);
    expect(await menuFor("event", ctx("u-head"))).toBeNull();
  });

  it("a task assignee, an org admin and everyone in a completed event get no menu", async () => {
    expect(await menuFor("task", ctx("u-nila"))).toBeNull();
    expect(await menuFor("venue", ctx("u-admin", { isOrgAdmin: true, isParticipant: false }))).toBeNull();
    expect(await menuFor("venue", ctx("u-owner", { eventStatus: "completed" }))).toBeNull();
  });
});
