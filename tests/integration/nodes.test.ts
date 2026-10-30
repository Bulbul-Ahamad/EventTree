// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actAs, admin, cleanup, createPersona, trackOrg, uniqueSlug, type Persona } from "./helpers/harness";

vi.mock("@/lib/supabase/server", async () => {
  const { current } = await import("./helpers/session");
  return {
    createServerClient: async () => {
      if (!current.client) throw new Error("actAs() was not called");
      return current.client;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { createEvent, setEventStatus } from "@/features/events/actions";
import { createNode, deleteNode, reassignNode, updateNode } from "@/features/nodes/actions";
import { getEventTree } from "@/features/nodes/queries";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";
import { walk } from "@/lib/tree";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let adm: Persona; // org admin, not assigned
let owner: Persona;
let h1: Persona; // head of S1 (and of nothing else)
let h2: Persona; // head of S2
let a1: Persona; // assignee of T1
let member: Persona; // org member, unassigned
let xena: Persona; // member of another org
let orgId: string;

const DUE = "2026-12-20T10:00:00.000Z";

async function expectFail(p: Promise<{ ok: boolean } & Record<string, unknown>>, code: string) {
  const r = await p;
  expect(r.ok, `expected ${code}`).toBe(false);
  expect(r.code).toBe(code);
}

async function mk(actor: Persona, body: Record<string, unknown>): Promise<string> {
  actAs(actor);
  const r = await createNode(body);
  if (!r.ok) throw new Error(`createNode failed: ${r.code} ${JSON.stringify(body)}`);
  return r.data.nodeId;
}

type Fixture = { event: string; s1: string; s2: string; s1a: string; t1: string; t2: string };

// Event(owner) > S1(h1) > S1a(h1) > T1(a1) ; S1 > T-own(h1) ; S2(h2) > T2(h2 peer: none)
async function fixture(opts: { activate?: boolean } = {}): Promise<Fixture> {
  actAs(owner);
  const ev = await createEvent({ orgId, title: "Node Event", reviewMode: "assignee_submits" });
  if (!ev.ok) throw new Error("createEvent failed");
  const event = ev.data.eventId;
  const s1 = await mk(owner, { parentId: event, type: "segment", title: "S1", assigneeId: h1.id });
  const s2 = await mk(owner, { parentId: event, type: "segment", title: "S2", assigneeId: h2.id });
  const s1a = await mk(h1, { parentId: s1, type: "segment", title: "S1a", assigneeId: h1.id });
  const t1 = await mk(h1, { parentId: s1a, type: "task", title: "T1", assigneeId: a1.id, dueAt: DUE, weight: 2 });
  const t2 = await mk(h2, { parentId: s2, type: "task", title: "T2" });
  if (opts.activate) {
    actAs(owner);
    const r = await setEventStatus({ eventId: event, to: "active" });
    if (!r.ok) throw new Error("activate failed");
  }
  return { event, s1, s2, s1a, t1, t2 };
}

beforeAll(async () => {
  [adm, owner, h1, h2, a1, member, xena] = await Promise.all([
    createPersona("adm"),
    createPersona("owner"),
    createPersona("h1"),
    createPersona("h2"),
    createPersona("a1"),
    createPersona("member"),
    createPersona("xena"),
  ]);
  actAs(adm);
  const slug = uniqueSlug();
  await createOrganization({ name: "Int Nodes Org", slug, kind: "club" });
  const { data: org } = await admin.from("organizations").select("id, join_code").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);
  for (const p of [owner, h1, h2, a1, member]) {
    actAs(p);
    const j = await joinOrganization({ code: org!.join_code });
    if (!j.ok) throw new Error(`join failed for ${p.name}`);
  }
  actAs(xena);
  await createOrganization({ name: "Xena Nodes Org", slug: uniqueSlug("x"), kind: "club" });
  const { data: xo } = await admin.from("organizations").select("id").eq("name", "Xena Nodes Org").order("created_at", { ascending: false }).limit(1).single();
  trackOrg(xo!.id);
});

afterAll(cleanup);

describe("createNode: who may add what (managers only)", () => {
  it("owner adds under the event, a head adds inside their own segment", async () => {
    const f = await fixture();
    actAs(owner);
    const tree = await getEventTree(f.event);
    expect(walk(tree!).map((n) => n.title)).toEqual(["Node Event", "S1", "S1a", "T1", "S2", "T2"]);
  });

  it("a head cannot add inside a sibling segment, an assignee cannot add anywhere", async () => {
    const f = await fixture();
    actAs(h1);
    await expectFail(createNode({ parentId: f.s2, type: "task", title: "Sneaky" }), "E_NOT_AUTHORIZED");
    actAs(h2);
    await expectFail(createNode({ parentId: f.s1a, type: "task", title: "Sneaky" }), "E_NOT_AUTHORIZED");
    actAs(a1);
    await expectFail(createNode({ parentId: f.s1a, type: "task", title: "Sneaky" }), "E_NOT_AUTHORIZED");
  });

  it("the org admin, a plain member and another org's user cannot add", async () => {
    const f = await fixture();
    for (const who of [adm, member, xena]) {
      actAs(who);
      await expectFail(createNode({ parentId: f.s1, type: "task", title: "Nope" }), "E_NOT_AUTHORIZED");
    }
  });

  it("a task is created todo with defaults; an empty assignee is allowed (Unassigned)", async () => {
    const f = await fixture();
    const id = await mk(h1, { parentId: f.s1, type: "task", title: "Defaults" });
    const { data } = await admin.from("nodes").select("status, priority, weight, assignee_id, depth").eq("id", id).single();
    expect(data).toMatchObject({ status: "todo", priority: "medium", weight: 1, assignee_id: null, depth: 2 });
  });

  it("a segment has no status and still shows in the tree with 0% progress", async () => {
    const f = await fixture();
    const id = await mk(owner, { parentId: f.event, type: "segment", title: "Empty seg" });
    actAs(owner);
    const node = walk((await getEventTree(f.event))!).find((n) => n.id === id);
    expect(node).toMatchObject({ type: "segment", status: null, progress: 0 });
  });

  it("tasks cannot contain items (E_PARENT_IS_TASK)", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(createNode({ parentId: f.t1, type: "task", title: "Child of task" }), "E_PARENT_IS_TASK");
  });

  it("nesting stops at depth 6 (E_MAX_DEPTH)", async () => {
    actAs(owner);
    const ev = await createEvent({ orgId, title: "Deep" });
    if (!ev.ok) throw new Error("createEvent failed");
    let parent = ev.data.eventId;
    for (let d = 1; d <= 6; d++) parent = await mk(owner, { parentId: parent, type: "segment", title: `L${d}` });
    actAs(owner);
    await expectFail(createNode({ parentId: parent, type: "task", title: "Too deep" }), "E_MAX_DEPTH");
  });

  it("assignees must belong to the organization (E_ASSIGNEE_NOT_IN_ORG)", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "X", assigneeId: xena.id }), "E_ASSIGNEE_NOT_IN_ORG");
  });

  it("is refused in a completed event (E_EVENT_READONLY)", async () => {
    const f = await fixture({ activate: true });
    actAs(owner);
    await setEventStatus({ eventId: f.event, to: "completed" });
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "Late" }), "E_EVENT_READONLY");
  });

  it("is refused in an unknown parent and on bad input", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(createNode({ parentId: "11111111-1111-1111-1111-111111111111", type: "task", title: "X" }), "E_NOT_FOUND");
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "" }), "E_VALIDATION");
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "X", weight: 0 }), "E_VALIDATION");
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "X", weight: 11 }), "E_VALIDATION");
    await expectFail(createNode({ parentId: f.s1, type: "event", title: "X" }), "E_VALIDATION");
    await expectFail(createNode({ parentId: f.s1, type: "task", title: "X", status: "verified" }), "E_VALIDATION");
  });

  it("stores Bangla and HTML-looking titles as plain text", async () => {
    const f = await fixture();
    const id = await mk(h1, { parentId: f.s1, type: "task", title: "<b>বুক করুন</b>" });
    const { data } = await admin.from("nodes").select("title").eq("id", id).single();
    expect(data?.title).toBe("<b>বুক করুন</b>");
  });
});

describe("getEventTree: visibility and roll-up", () => {
  it("every participant and the org admin see the whole event; others get null", async () => {
    const f = await fixture();
    for (const who of [owner, h1, h2, a1, adm]) {
      actAs(who);
      const tree = await getEventTree(f.event);
      expect(walk(tree!).length, who.name).toBe(6);
    }
    for (const who of [member, xena]) {
      actAs(who);
      expect(await getEventTree(f.event), who.name).toBeNull();
    }
  });

  it("returns owner and assignee names, and progress rolls up after verification", async () => {
    const f = await fixture({ activate: true });
    actAs(a1);
    await a1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "todo", p_to: "in_progress" });
    await a1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "in_progress", p_to: "submitted" });
    await h1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "submitted", p_to: "verified" });
    actAs(owner);
    const nodes = walk((await getEventTree(f.event))!);
    const by = Object.fromEntries(nodes.map((n) => [n.title, n]));
    expect(by["T1"]).toMatchObject({ status: "verified", progress: 100, assignee_name: "Int a1" });
    expect(by["S1a"]?.progress).toBe(100);
    expect(by["S1"]?.progress).toBe(100);
    expect(by["S2"]?.progress).toBe(0);
    expect(by["Node Event"]?.progress).toBe(50);
  });
});

describe("updateNode", () => {
  it("strict managers can edit: the owner and the heads above the node", async () => {
    const f = await fixture();
    actAs(h1);
    expect((await updateNode({ nodeId: f.t1, title: "Renamed by head", priority: "urgent" })).ok).toBe(true);
    actAs(owner);
    expect((await updateNode({ nodeId: f.t1, weight: 5, description: "Details" })).ok).toBe(true);
    const { data } = await admin.from("nodes").select("title, priority, weight, description").eq("id", f.t1).single();
    expect(data).toEqual({ title: "Renamed by head", priority: "urgent", weight: 5, description: "Details" });
  });

  it("a head cannot edit their own segment, only the owner can", async () => {
    const f = await fixture();
    actAs(h1);
    await expectFail(updateNode({ nodeId: f.s1, title: "Mine now" }), "E_NOT_AUTHORIZED");
    actAs(owner);
    expect((await updateNode({ nodeId: f.s1, title: "Renamed S1" })).ok).toBe(true);
  });

  it("a sibling head, the task's assignee, the org admin cannot edit", async () => {
    const f = await fixture();
    for (const who of [h2, a1, adm]) {
      actAs(who);
      await expectFail(updateNode({ nodeId: f.t1, title: "Hacked" }), "E_NOT_AUTHORIZED");
    }
    const { data } = await admin.from("nodes").select("title").eq("id", f.t1).single();
    expect(data?.title).toBe("T1");
  });

  it("someone who cannot see the event gets E_NOT_FOUND", async () => {
    const f = await fixture();
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(updateNode({ nodeId: f.t1, title: "Nope" }), "E_NOT_FOUND");
    }
  });

  it("changes only the fields sent, and null clears description or due date", async () => {
    const f = await fixture();
    actAs(owner);
    await updateNode({ nodeId: f.t1, description: "To clear" });
    await updateNode({ nodeId: f.t1, weight: 7 });
    let row = (await admin.from("nodes").select("title, weight, description, due_at").eq("id", f.t1).single()).data;
    expect(row).toMatchObject({ title: "T1", weight: 7, description: "To clear" });
    expect(row?.due_at).not.toBeNull();
    await updateNode({ nodeId: f.t1, description: null, dueAt: null });
    row = (await admin.from("nodes").select("title, weight, description, due_at").eq("id", f.t1).single()).data;
    expect(row).toMatchObject({ title: "T1", weight: 7, description: null, due_at: null });
  });

  it("a weight change moves the parent's progress (roll-up trigger)", async () => {
    const f = await fixture({ activate: true });
    actAs(owner);
    await h1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "todo", p_to: "in_progress" });
    await a1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "in_progress", p_to: "submitted" });
    await owner.client.rpc("transition_task_status", { p_node: f.t1, p_from: "submitted", p_to: "verified" });
    // add a second, unverified task of weight 2 next to T1 (weight 2) -> S1a = 50
    const other = await mk(h1, { parentId: f.s1a, type: "task", title: "Other", weight: 2 });
    actAs(owner);
    const read = async (title: string) => walk((await getEventTree(f.event))!).find((n) => n.title === title)?.progress;
    expect(await read("S1a")).toBe(50);
    await updateNode({ nodeId: other, weight: 6 });
    expect(await read("S1a")).toBe(25); // (100*2 + 0*6) / 8
  });

  it("rejects empty updates, bad values and attempts to set status or progress", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(updateNode({ nodeId: f.t1 }), "E_VALIDATION");
    await expectFail(updateNode({ nodeId: f.t1, weight: 11 }), "E_VALIDATION");
    await expectFail(updateNode({ nodeId: f.t1, title: "  " }), "E_VALIDATION");
    await expectFail(updateNode({ nodeId: f.t1, status: "verified" }), "E_VALIDATION");
    await expectFail(updateNode({ nodeId: f.t1, progress_cached: 100 }), "E_VALIDATION");
    await expectFail(updateNode({ nodeId: f.t1, parentId: f.s2 }), "E_VALIDATION");
  });

  it("is refused in a completed event (E_EVENT_READONLY)", async () => {
    const f = await fixture({ activate: true });
    actAs(owner);
    await setEventStatus({ eventId: f.event, to: "completed" });
    await expectFail(updateNode({ nodeId: f.t1, title: "Late" }), "E_EVENT_READONLY");
  });
});

describe("reassignNode", () => {
  it("a strict manager reassigns; the old assignee loses access, the new one gains it", async () => {
    const f = await fixture();
    actAs(a1);
    expect(await getEventTree(f.event)).not.toBeNull();
    actAs(h1);
    expect((await reassignNode({ nodeId: f.t1, assigneeId: member.id })).ok).toBe(true);
    actAs(a1);
    expect(await getEventTree(f.event)).toBeNull(); // US-15 AC2
    actAs(member);
    expect(await getEventTree(f.event)).not.toBeNull();
  });

  it("can unassign (null) and the tree shows Unassigned", async () => {
    const f = await fixture();
    actAs(owner);
    expect((await reassignNode({ nodeId: f.t1, assigneeId: null })).ok).toBe(true);
    const t1 = walk((await getEventTree(f.event))!).find((n) => n.id === f.t1);
    expect(t1).toMatchObject({ assignee_id: null, assignee_name: null });
  });

  it("cannot assign someone outside the organization", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(reassignNode({ nodeId: f.t1, assigneeId: xena.id }), "E_ASSIGNEE_NOT_IN_ORG");
  });

  it("the event owner cannot be changed (E_ROOT_IMMUTABLE)", async () => {
    const f = await fixture();
    actAs(owner);
    await expectFail(reassignNode({ nodeId: f.event, assigneeId: h1.id }), "E_ROOT_IMMUTABLE");
  });

  it("a head cannot reassign their own segment, a sibling head or assignee cannot reassign", async () => {
    const f = await fixture();
    actAs(h1);
    await expectFail(reassignNode({ nodeId: f.s1, assigneeId: member.id }), "E_NOT_AUTHORIZED");
    for (const who of [h2, a1, adm]) {
      actAs(who);
      await expectFail(reassignNode({ nodeId: f.t1, assigneeId: member.id }), "E_NOT_AUTHORIZED");
    }
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(reassignNode({ nodeId: f.t1, assigneeId: who.id }), "E_NOT_FOUND");
    }
  });
});

describe("deleteNode", () => {
  it("a strict manager deletes a node and its whole subtree", async () => {
    const f = await fixture();
    actAs(h1);
    expect((await deleteNode({ nodeId: f.s1a })).ok).toBe(true);
    actAs(owner);
    const titles = walk((await getEventTree(f.event))!).map((n) => n.title);
    expect(titles).toEqual(["Node Event", "S1", "S2", "T2"]);
    const { count } = await admin.from("nodes").select("id", { count: "exact", head: true }).in("id", [f.s1a, f.t1]);
    expect(count).toBe(0);
  });

  it("deleting a verified task lowers nothing wrongly: parent progress is recomputed", async () => {
    const f = await fixture({ activate: true });
    await h1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "todo", p_to: "in_progress" });
    await a1.client.rpc("transition_task_status", { p_node: f.t1, p_from: "in_progress", p_to: "submitted" });
    await owner.client.rpc("transition_task_status", { p_node: f.t1, p_from: "submitted", p_to: "verified" });
    actAs(owner);
    const read = async (title: string) => walk((await getEventTree(f.event))!).find((n) => n.title === title)?.progress;
    expect(await read("S1a")).toBe(100);
    await deleteNode({ nodeId: f.t1 });
    expect(await read("S1a")).toBe(0); // empty segment
  });

  it("a head cannot delete their own segment; sibling head, assignee and org admin cannot delete", async () => {
    const f = await fixture();
    actAs(h1);
    await expectFail(deleteNode({ nodeId: f.s1 }), "E_NOT_AUTHORIZED");
    for (const who of [h2, a1, adm]) {
      actAs(who);
      await expectFail(deleteNode({ nodeId: f.t1 }), "E_NOT_AUTHORIZED");
    }
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(deleteNode({ nodeId: f.t1 }), "E_NOT_FOUND");
    }
    actAs(owner);
    expect(walk((await getEventTree(f.event))!).length).toBe(6);
  });

  it("is refused in a completed event (E_EVENT_READONLY)", async () => {
    const f = await fixture({ activate: true });
    actAs(owner);
    await setEventStatus({ eventId: f.event, to: "completed" });
    await expectFail(deleteNode({ nodeId: f.t1 }), "E_EVENT_READONLY");
  });

  it("an unknown id is E_NOT_FOUND", async () => {
    actAs(owner);
    await expectFail(deleteNode({ nodeId: "11111111-1111-1111-1111-111111111111" }), "E_NOT_FOUND");
    await expectFail(deleteNode({ nodeId: "bad" }), "E_VALIDATION");
  });
});
