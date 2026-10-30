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

import { getMyEvents, getMyTasks, getReviewQueue } from "@/features/dashboard/queries";
import { createEvent, setEventStatus } from "@/features/events/actions";
import { createNode, reassignNode } from "@/features/nodes/actions";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";
import { transitionTask } from "@/features/updates/actions";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let owner: Persona;
let h1: Persona; // head of S1
let a1: Persona; // assignee of several tasks
let a2: Persona; // assignee of one task
let adm: Persona; // org admin, not assigned
let member: Persona; // org member, in no event
let xena: Persona; // other org
let orgId: string;

const DAY = 24 * 3600 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString();

async function mk(actor: Persona, body: Record<string, unknown>): Promise<string> {
  actAs(actor);
  const r = await createNode(body);
  if (!r.ok) throw new Error(`createNode failed: ${r.code}`);
  return r.data.nodeId;
}

async function newEvent(title: string, activate: boolean): Promise<string> {
  actAs(owner);
  const ev = await createEvent({ orgId, title, reviewMode: "assignee_submits" });
  if (!ev.ok) throw new Error("createEvent failed");
  if (activate) {
    const r = await setEventStatus({ eventId: ev.data.eventId, to: "active" });
    if (!r.ok) throw new Error("activate failed");
  }
  return ev.data.eventId;
}

async function go(who: Persona, nodeId: string, from: string, to: string, comment?: string) {
  actAs(who);
  const r = await transitionTask({ nodeId, from, to, ...(comment ? { comment } : {}) });
  if (!r.ok) throw new Error(`transition ${from}>${to} failed: ${r.code}`);
}

const titles = (list: { title: string }[]) => list.map((t) => t.title);

beforeAll(async () => {
  [owner, h1, a1, a2, adm, member, xena] = await Promise.all([
    createPersona("downer"),
    createPersona("dh1"),
    createPersona("da1"),
    createPersona("da2"),
    createPersona("dadm"),
    createPersona("dmember"),
    createPersona("dxena"),
  ]);
  actAs(adm);
  const slug = uniqueSlug();
  await createOrganization({ name: "Int Dash Org", slug, kind: "club" });
  const { data: org } = await admin.from("organizations").select("id, join_code").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);
  for (const p of [owner, h1, a1, a2, member]) {
    actAs(p);
    const j = await joinOrganization({ code: org!.join_code });
    if (!j.ok) throw new Error(`join failed for ${p.name}`);
  }
  actAs(xena);
  await createOrganization({ name: "Xena Dash Org", slug: uniqueSlug("x"), kind: "club" });
  const { data: xo } = await admin.from("organizations").select("id").eq("name", "Xena Dash Org").order("created_at", { ascending: false }).limit(1).single();
  trackOrg(xo!.id);
});

afterAll(cleanup);

describe("getMyTasks", () => {
  it("groups my tasks across events: overdue, due this week, later, no due date", async () => {
    const e1 = await newEvent("Dash A", true);
    const e2 = await newEvent("Dash B (draft)", false);
    const s1 = await mk(owner, { parentId: e1, type: "segment", title: "SegA", assigneeId: h1.id });
    await mk(h1, { parentId: s1, type: "task", title: "Past due", assigneeId: a2.id, dueAt: inDays(-3) }); // other person's
    const s2 = await mk(owner, { parentId: e2, type: "segment", title: "SegB", assigneeId: h1.id });
    await mk(h1, { parentId: s1, type: "task", title: "Overdue", assigneeId: a1.id, dueAt: inDays(-2) });
    await mk(h1, { parentId: s1, type: "task", title: "Soon", assigneeId: a1.id, dueAt: inDays(3) });
    await mk(h1, { parentId: s1, type: "task", title: "Far", assigneeId: a1.id, dueAt: inDays(40) });
    await mk(h1, { parentId: s1, type: "task", title: "Whenever", assigneeId: a1.id });
    await mk(h1, { parentId: s2, type: "task", title: "Draft task", assigneeId: a1.id, dueAt: inDays(-5) });

    actAs(a1);
    const g = await getMyTasks();
    expect(titles(g.overdue)).toEqual(["Overdue"]);
    expect(titles(g.dueThisWeek)).toEqual(["Draft task", "Soon"]); // draft event: past due is not overdue
    expect(titles(g.later)).toEqual(["Far"]);
    expect(titles(g.noDueDate)).toEqual(["Whenever"]);
    expect(g.overdue[0]).toMatchObject({ eventTitle: "Dash A", eventStatus: "active", status: "todo" });
  });

  it("a verified task past its date is not overdue, and completed events drop out", async () => {
    const e = await newEvent("Dash C", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegC", assigneeId: h1.id });
    const t = await mk(h1, { parentId: s, type: "task", title: "Finished late", assigneeId: a1.id, dueAt: inDays(-1) });
    await go(a1, t, "todo", "in_progress");
    await go(a1, t, "in_progress", "submitted");
    await go(h1, t, "submitted", "verified");

    const e2 = await newEvent("Dash D", true);
    const s2 = await mk(owner, { parentId: e2, type: "segment", title: "SegD", assigneeId: h1.id });
    await mk(h1, { parentId: s2, type: "task", title: "In finished event", assigneeId: a1.id, dueAt: inDays(1) });
    actAs(owner);
    await setEventStatus({ eventId: e2, to: "completed" });

    actAs(a1);
    const g = await getMyTasks();
    expect(titles(g.overdue)).not.toContain("Finished late");
    expect(titles(g.dueThisWeek)).toContain("Finished late");
    const all = [...g.overdue, ...g.dueThisWeek, ...g.later, ...g.noDueDate];
    expect(titles(all)).not.toContain("In finished event");
  });

  it("shows only my own tasks; people without tasks get empty groups", async () => {
    for (const who of [member, adm, xena, owner]) {
      actAs(who);
      const g = await getMyTasks();
      expect([...g.overdue, ...g.dueThisWeek, ...g.later, ...g.noDueDate], who.name).toEqual([]);
    }
    actAs(a2);
    const g = await getMyTasks();
    expect(titles(g.overdue)).toEqual(["Past due"]);
  });

  it("a reassigned task moves from one person's list to the other's", async () => {
    const e = await newEvent("Dash E", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegE", assigneeId: h1.id });
    const t = await mk(h1, { parentId: s, type: "task", title: "Movable", assigneeId: a1.id });
    actAs(h1);
    expect((await reassignNode({ nodeId: t, assigneeId: a2.id })).ok).toBe(true);
    actAs(a1);
    expect(titles((await getMyTasks()).noDueDate)).not.toContain("Movable");
    actAs(a2);
    expect(titles((await getMyTasks()).noDueDate)).toContain("Movable");
  });
});

describe("getReviewQueue", () => {
  it("lists submitted tasks for the managers above them, oldest first, hidden from everyone else", async () => {
    const e = await newEvent("Review A", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegR", assigneeId: h1.id });
    const first = await mk(h1, { parentId: s, type: "task", title: "R first", assigneeId: a1.id });
    const second = await mk(h1, { parentId: s, type: "task", title: "R second", assigneeId: a2.id });
    const idle = await mk(h1, { parentId: s, type: "task", title: "R idle", assigneeId: a1.id });
    await go(a1, first, "todo", "in_progress");
    await go(a1, first, "in_progress", "submitted");
    await go(a2, second, "todo", "in_progress");
    await go(a2, second, "in_progress", "submitted");
    await go(a1, idle, "todo", "in_progress"); // not submitted

    for (const who of [h1, owner]) {
      actAs(who);
      const q = (await getReviewQueue()).filter((r) => r.eventId === e);
      expect(titles(q), who.name).toEqual(["R first", "R second"]);
      expect(q[0]).toMatchObject({ eventTitle: "Review A", assigneeName: "Int da1" });
    }
    for (const who of [a1, a2, adm, member, xena]) {
      actAs(who);
      expect((await getReviewQueue()).filter((r) => r.eventId === e), who.name).toEqual([]);
    }
  });

  it("a head's own submitted task goes to the owner, not to the head (self-verify rule)", async () => {
    const e = await newEvent("Review B", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegRB", assigneeId: h1.id });
    const own = await mk(owner, { parentId: s, type: "task", title: "Head's own", assigneeId: h1.id });
    await go(h1, own, "todo", "in_progress");
    await go(h1, own, "in_progress", "submitted");
    actAs(h1);
    expect((await getReviewQueue()).filter((r) => r.eventId === e)).toEqual([]);
    actAs(owner);
    expect(titles((await getReviewQueue()).filter((r) => r.eventId === e))).toEqual(["Head's own"]);
  });

  it("a task leaves the queue once verified or sent back, and completed events are excluded", async () => {
    const e = await newEvent("Review C", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegRC", assigneeId: h1.id });
    const t = await mk(h1, { parentId: s, type: "task", title: "Cycle", assigneeId: a1.id });
    await go(a1, t, "todo", "in_progress");
    await go(a1, t, "in_progress", "submitted");
    const mine = async () => {
      actAs(h1);
      return (await getReviewQueue()).filter((r) => r.eventId === e);
    };
    expect(titles(await mine())).toEqual(["Cycle"]);
    await go(h1, t, "submitted", "in_progress", "Redo please");
    expect(await mine()).toEqual([]);
    await go(a1, t, "in_progress", "submitted");
    expect(titles(await mine())).toEqual(["Cycle"]);
    actAs(owner);
    await setEventStatus({ eventId: e, to: "completed" });
    expect(await mine()).toEqual([]);
  });
});

describe("getMyEvents", () => {
  it("shows my events across roles with org, status, progress and role chip", async () => {
    const e = await newEvent("Mine A", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegM", assigneeId: h1.id });
    const t = await mk(h1, { parentId: s, type: "task", title: "TM", assigneeId: a1.id });
    await go(a1, t, "todo", "in_progress");
    await go(a1, t, "in_progress", "submitted");
    await go(h1, t, "submitted", "verified");

    const pick = async (who: Persona) => {
      actAs(who);
      return (await getMyEvents()).find((x) => x.id === e);
    };
    expect(await pick(owner)).toMatchObject({ title: "Mine A", orgName: "Int Dash Org", status: "active", progress: 100, role: "owner" });
    expect(await pick(h1)).toMatchObject({ role: "head" });
    expect(await pick(a1)).toMatchObject({ role: "assignee" });
  });

  it("excludes events I am not part of, including for the org admin and other orgs", async () => {
    const e = await newEvent("Mine B", true);
    await mk(owner, { parentId: e, type: "segment", title: "SegMB", assigneeId: h1.id });
    for (const who of [adm, member, xena]) {
      actAs(who);
      expect((await getMyEvents()).map((x) => x.id), who.name).not.toContain(e);
    }
    actAs(a2);
    expect((await getMyEvents()).map((x) => x.id)).not.toContain(e);
  });

  it("lists active before draft before completed, and nothing for a user with no events", async () => {
    await newEvent("Order draft", false);
    const done = await newEvent("Order done", true);
    actAs(owner);
    await setEventStatus({ eventId: done, to: "completed" });
    const mine = (await getMyEvents()).filter((x) => x.title.startsWith("Order"));
    expect(mine.map((x) => x.status)).toEqual(["draft", "completed"]);
    actAs(member);
    expect(await getMyEvents()).toEqual([]);
  });

  it("an assigned event keeps showing after I am reassigned only if I still hold a node there", async () => {
    const e = await newEvent("Mine C", true);
    const s = await mk(owner, { parentId: e, type: "segment", title: "SegMC", assigneeId: h1.id });
    const t = await mk(h1, { parentId: s, type: "task", title: "TMC", assigneeId: a2.id });
    actAs(a2);
    expect((await getMyEvents()).map((x) => x.id)).toContain(e);
    actAs(h1);
    await reassignNode({ nodeId: t, assigneeId: null });
    actAs(a2);
    expect((await getMyEvents()).map((x) => x.id)).not.toContain(e);
  });
});
