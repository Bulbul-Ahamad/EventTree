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
import { createNode } from "@/features/nodes/actions";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";
import { addComment, addProofLink, transitionTask } from "@/features/updates/actions";
import { getNodeActivity } from "@/features/updates/queries";
import type { TablesInsert } from "@/types/database";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let owner: Persona; // event owner
let h1: Persona; // head of S1
let a1: Persona; // assignee of T1
let b1: Persona; // assignee of T2 (sibling task)
let adm: Persona; // org admin, not assigned
let member: Persona; // org member, not in the event
let xena: Persona; // other org
let orgId: string;

async function expectFail(p: Promise<{ ok: boolean } & Record<string, unknown>>, code: string) {
  const r = await p;
  expect(r.ok, `expected ${code}`).toBe(false);
  expect(r.code).toBe(code);
}

async function mk(actor: Persona, body: Record<string, unknown>): Promise<string> {
  actAs(actor);
  const r = await createNode(body);
  if (!r.ok) throw new Error(`createNode failed: ${r.code}`);
  return r.data.nodeId;
}

type Fx = { event: string; s1: string; t1: string; t2: string };

// Event(owner) > S1(h1) > T1(a1), T2(b1)
async function fixture(mode: "assignee_submits" | "head_only", activate = true): Promise<Fx> {
  actAs(owner);
  const ev = await createEvent({ orgId, title: "Updates Event", reviewMode: mode });
  if (!ev.ok) throw new Error("createEvent failed");
  const event = ev.data.eventId;
  const s1 = await mk(owner, { parentId: event, type: "segment", title: "S1", assigneeId: h1.id });
  const t1 = await mk(h1, { parentId: s1, type: "task", title: "T1", assigneeId: a1.id });
  const t2 = await mk(h1, { parentId: s1, type: "task", title: "T2", assigneeId: b1.id });
  if (activate) {
    actAs(owner);
    const r = await setEventStatus({ eventId: event, to: "active" });
    if (!r.ok) throw new Error("activate failed");
  }
  return { event, s1, t1, t2 };
}

async function go(who: Persona, nodeId: string, from: string, to: string, comment?: string) {
  actAs(who);
  return transitionTask({ nodeId, from, to, ...(comment ? { comment } : {}) });
}

async function statusOf(id: string) {
  return (await admin.from("nodes").select("status").eq("id", id).single()).data?.status;
}

beforeAll(async () => {
  [owner, h1, a1, b1, adm, member, xena] = await Promise.all([
    createPersona("uowner"),
    createPersona("uh1"),
    createPersona("ua1"),
    createPersona("ub1"),
    createPersona("uadm"),
    createPersona("umember"),
    createPersona("uxena"),
  ]);
  actAs(adm);
  const slug = uniqueSlug();
  await createOrganization({ name: "Int Updates Org", slug, kind: "club" });
  const { data: org } = await admin.from("organizations").select("id, join_code").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);
  for (const p of [owner, h1, a1, b1, member]) {
    actAs(p);
    const j = await joinOrganization({ code: org!.join_code });
    if (!j.ok) throw new Error(`join failed for ${p.name}`);
  }
  actAs(xena);
  await createOrganization({ name: "Xena Updates Org", slug: uniqueSlug("x"), kind: "club" });
  const { data: xo } = await admin.from("organizations").select("id").eq("name", "Xena Updates Org").order("created_at", { ascending: false }).limit(1).single();
  trackOrg(xo!.id);
});

afterAll(cleanup);

describe("transitionTask: assignee_submits mode", () => {
  it("T1/T3/T4: assignee starts and submits, a head verifies; history is logged", async () => {
    const f = await fixture("assignee_submits");
    expect((await go(a1, f.t1, "todo", "in_progress")).ok).toBe(true); // T1
    expect((await go(a1, f.t1, "in_progress", "submitted", "Done, see link")).ok).toBe(true); // T3
    const v = await go(h1, f.t1, "submitted", "verified"); // T4
    expect(v).toMatchObject({ ok: true, data: { status: "verified" } });
    const row = (await admin.from("nodes").select("status, verified_by, verified_at, submitted_at").eq("id", f.t1).single()).data;
    expect(row?.status).toBe("verified");
    expect(row?.verified_by).toBe(h1.id);
    expect(row?.verified_at).not.toBeNull();
    expect(row?.submitted_at).not.toBeNull();

    actAs(owner);
    const log = await getNodeActivity(f.t1);
    expect(log.map((l) => `${l.fromStatus}>${l.toStatus}`)).toEqual(["submitted>verified", "in_progress>submitted", "todo>in_progress"]);
    expect(log[1]).toMatchObject({ kind: "status_change", body: "Done, see link", authorName: "Int ua1" });
  });

  it("T2: assignee or manager moves in_progress back to todo", async () => {
    const f = await fixture("assignee_submits");
    await go(a1, f.t1, "todo", "in_progress");
    expect((await go(a1, f.t1, "in_progress", "todo")).ok).toBe(true);
    await go(h1, f.t1, "todo", "in_progress");
    expect((await go(h1, f.t1, "in_progress", "todo")).ok).toBe(true);
  });

  it("T5: a manager sends submitted work back, comment required", async () => {
    const f = await fixture("assignee_submits");
    await go(a1, f.t1, "todo", "in_progress");
    await go(a1, f.t1, "in_progress", "submitted");
    await expectFail(go(h1, f.t1, "submitted", "in_progress"), "E_COMMENT_REQUIRED");
    await expectFail(go(h1, f.t1, "submitted", "in_progress", "   "), "E_COMMENT_REQUIRED");
    expect((await go(h1, f.t1, "submitted", "in_progress", "Fix the venue name")).ok).toBe(true);
    expect(await statusOf(f.t1)).toBe("in_progress");
  });

  it("T7: a manager reopens a verified task, comment required, verification cleared", async () => {
    const f = await fixture("assignee_submits");
    await go(a1, f.t1, "todo", "in_progress");
    await go(a1, f.t1, "in_progress", "submitted");
    await go(h1, f.t1, "submitted", "verified");
    await expectFail(go(h1, f.t1, "verified", "in_progress"), "E_COMMENT_REQUIRED");
    expect((await go(owner, f.t1, "verified", "in_progress", "Reopened: wrong date")).ok).toBe(true);
    const row = (await admin.from("nodes").select("status, verified_by, verified_at").eq("id", f.t1).single()).data;
    expect(row).toEqual({ status: "in_progress", verified_by: null, verified_at: null });
  });

  it("T6 is not allowed: no skipping to verified", async () => {
    const f = await fixture("assignee_submits");
    await expectFail(go(h1, f.t1, "todo", "verified"), "E_INVALID_TRANSITION");
    await expectFail(go(h1, f.t1, "todo", "submitted"), "E_INVALID_TRANSITION");
  });

  it("an assignee cannot verify their own work unless they own the event", async () => {
    const f = await fixture("assignee_submits");
    // h1 owns segment S1 and is also given a task of their own
    const own = await mk(owner, { parentId: f.s1, type: "task", title: "Own", assigneeId: h1.id });
    await go(h1, own, "todo", "in_progress");
    await go(h1, own, "in_progress", "submitted");
    await expectFail(go(h1, own, "submitted", "verified"), "E_INVALID_TRANSITION");
    expect((await go(owner, own, "submitted", "verified")).ok).toBe(true);
  });

  it("the owner who is also the assignee may verify their own task", async () => {
    const f = await fixture("assignee_submits");
    const own = await mk(owner, { parentId: f.s1, type: "task", title: "Owner task", assigneeId: owner.id });
    await go(owner, own, "todo", "in_progress");
    await go(owner, own, "in_progress", "submitted");
    expect((await go(owner, own, "submitted", "verified")).ok).toBe(true);
  });

  it("a sibling task's assignee, org admin and outsiders cannot change status", async () => {
    const f = await fixture("assignee_submits");
    await expectFail(go(b1, f.t1, "todo", "in_progress"), "E_INVALID_TRANSITION");
    await expectFail(go(adm, f.t1, "todo", "in_progress"), "E_INVALID_TRANSITION"); // admin can view, not act
    await expectFail(go(member, f.t1, "todo", "in_progress"), "E_NOT_FOUND");
    await expectFail(go(xena, f.t1, "todo", "in_progress"), "E_NOT_FOUND");
    expect(await statusOf(f.t1)).toBe("todo");
  });
});

describe("transitionTask: head_only mode", () => {
  it("the assignee cannot submit; a head verifies directly (T6) from todo or in_progress", async () => {
    const f = await fixture("head_only");
    await go(a1, f.t1, "todo", "in_progress");
    await expectFail(go(a1, f.t1, "in_progress", "submitted"), "E_INVALID_TRANSITION"); // T3 needs assignee_submits
    expect((await go(h1, f.t1, "in_progress", "verified")).ok).toBe(true); // T6
    expect((await go(h1, f.t2, "todo", "verified")).ok).toBe(true); // T6 from todo
    expect(await statusOf(f.t2)).toBe("verified");
  });

  it("the assignee cannot verify even their own task", async () => {
    const f = await fixture("head_only");
    await expectFail(go(a1, f.t1, "todo", "verified"), "E_INVALID_TRANSITION");
  });
});

describe("transitionTask: stale state, lifecycle and input", () => {
  it("E_STALE_STATE when the task moved since the caller looked", async () => {
    const f = await fixture("assignee_submits");
    await go(a1, f.t1, "todo", "in_progress");
    await expectFail(go(h1, f.t1, "todo", "in_progress"), "E_STALE_STATE");
    expect(await statusOf(f.t1)).toBe("in_progress");
  });

  it("two simultaneous identical changes: exactly one wins, the other is stale", async () => {
    const f = await fixture("assignee_submits");
    actAs(a1);
    const a = transitionTask({ nodeId: f.t1, from: "todo", to: "in_progress" });
    const b = transitionTask({ nodeId: f.t1, from: "todo", to: "in_progress" });
    const results = await Promise.all([a, b]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const lost = results.find((r) => !r.ok);
    expect(lost && !lost.ok && lost.code).toBe("E_STALE_STATE");
  });

  it("E_EVENT_NOT_ACTIVE in a draft and in a completed event", async () => {
    const draft = await fixture("assignee_submits", false);
    await expectFail(go(a1, draft.t1, "todo", "in_progress"), "E_EVENT_NOT_ACTIVE");
    const done = await fixture("assignee_submits");
    actAs(owner);
    await setEventStatus({ eventId: done.event, to: "completed" });
    await expectFail(go(a1, done.t1, "todo", "in_progress"), "E_EVENT_NOT_ACTIVE");
  });

  it("a segment or unknown id is E_NOT_FOUND; bad input is E_VALIDATION", async () => {
    const f = await fixture("assignee_submits");
    await expectFail(go(h1, f.s1, "todo", "in_progress"), "E_NOT_FOUND");
    await expectFail(go(h1, "11111111-1111-1111-1111-111111111111", "todo", "in_progress"), "E_NOT_FOUND");
    actAs(h1);
    await expectFail(transitionTask({ nodeId: f.t1, from: "todo", to: "todo" }), "E_VALIDATION");
    await expectFail(transitionTask({ nodeId: f.t1, from: "todo", to: "done" }), "E_VALIDATION");
    await expectFail(transitionTask({ nodeId: f.t1, from: "todo", to: "in_progress", comment: "x".repeat(2001) }), "E_VALIDATION");
    await expectFail(transitionTask({ nodeId: f.t1, from: "todo", to: "in_progress", extra: 1 }), "E_VALIDATION");
  });

  it("progress rolls up through the action layer", async () => {
    const f = await fixture("head_only");
    await go(h1, f.t1, "todo", "verified");
    const read = async (id: string) => (await admin.from("nodes").select("progress_cached").eq("id", id).single()).data?.progress_cached;
    expect(await read(f.s1)).toBe(50);
    expect(await read(f.event)).toBe(50);
    await go(h1, f.t2, "todo", "verified");
    expect(await read(f.event)).toBe(100);
  });
});

describe("addComment and addProofLink", () => {
  it("the assignee and the managers above can comment; the timeline is newest first", async () => {
    const f = await fixture("assignee_submits");
    for (const [who, text] of [[a1, "first"], [h1, "second"], [owner, "third"]] as const) {
      actAs(who);
      expect((await addComment({ nodeId: f.t1, body: text })).ok, who.name).toBe(true);
    }
    actAs(a1);
    const log = await getNodeActivity(f.t1);
    expect(log.map((l) => l.body)).toEqual(["third", "second", "first"]);
    expect(log[0]).toMatchObject({ kind: "comment", authorName: "Int uowner", authorId: owner.id });
  });

  it("a sibling task's assignee and the org admin cannot comment; outsiders cannot see the task", async () => {
    const f = await fixture("assignee_submits");
    for (const who of [b1, adm]) {
      actAs(who);
      await expectFail(addComment({ nodeId: f.t1, body: "hi" }), "E_NOT_AUTHORIZED");
    }
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(addComment({ nodeId: f.t1, body: "hi" }), "E_NOT_FOUND");
    }
    const { count } = await admin.from("node_updates").select("id", { count: "exact", head: true }).eq("node_id", f.t1);
    expect(count).toBe(0);
  });

  it("validates comment text (empty, whitespace, > 2000) and stores HTML as plain text", async () => {
    const f = await fixture("assignee_submits");
    actAs(a1);
    await expectFail(addComment({ nodeId: f.t1, body: "" }), "E_VALIDATION");
    await expectFail(addComment({ nodeId: f.t1, body: "   " }), "E_VALIDATION");
    await expectFail(addComment({ nodeId: f.t1, body: "x".repeat(2001) }), "E_VALIDATION");
    await expectFail(addComment({ nodeId: f.t1, body: "ok", userId: owner.id }), "E_VALIDATION");
    expect((await addComment({ nodeId: f.t1, body: "<script>alert(1)</script> ঠিক আছে" })).ok).toBe(true);
    const log = await getNodeActivity(f.t1);
    expect(log[0]?.body).toBe("<script>alert(1)</script> ঠিক আছে");
  });

  it("adds proof links with an optional note; only http(s) is accepted", async () => {
    const f = await fixture("assignee_submits");
    actAs(a1);
    expect((await addProofLink({ nodeId: f.t1, url: "https://example.com/photo.jpg", note: "Venue photo" })).ok).toBe(true);
    expect((await addProofLink({ nodeId: f.t1, url: "http://example.com/x" })).ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "ftp://example.com", "example.com", "https://", "data:text/html,hi"]) {
      await expectFail(addProofLink({ nodeId: f.t1, url: bad }), "E_VALIDATION");
    }
    const log = await getNodeActivity(f.t1);
    expect(log.map((l) => [l.kind, l.linkUrl, l.body])).toEqual([
      ["proof_link", "http://example.com/x", null],
      ["proof_link", "https://example.com/photo.jpg", "Venue photo"],
    ]);
    actAs(b1);
    await expectFail(addProofLink({ nodeId: f.t1, url: "https://example.com" }), "E_NOT_AUTHORIZED");
  });
});

describe("getNodeActivity: visibility and immutability", () => {
  it("is visible to event participants and org admin; empty for others", async () => {
    const f = await fixture("assignee_submits");
    actAs(a1);
    await addComment({ nodeId: f.t1, body: "hello" });
    for (const who of [owner, h1, a1, b1, adm]) {
      actAs(who);
      expect((await getNodeActivity(f.t1)).length, who.name).toBe(1);
    }
    for (const who of [member, xena]) {
      actAs(who);
      expect(await getNodeActivity(f.t1), who.name).toEqual([]);
    }
  });

  it("the log cannot be edited or deleted, not even by the event owner", async () => {
    const f = await fixture("assignee_submits");
    actAs(a1);
    await addComment({ nodeId: f.t1, body: "keep me" });
    const row = (await a1.client.from("node_updates").select("id").eq("node_id", f.t1).single()).data;
    for (const who of [a1, owner]) {
      const u = await who.client.from("node_updates").update({ body: "edited" }).eq("id", row!.id);
      const d = await who.client.from("node_updates").delete().eq("id", row!.id);
      expect(u.error ?? d.error, who.name).not.toBeNull();
    }
    const still = (await admin.from("node_updates").select("body").eq("id", row!.id).single()).data;
    expect(still?.body).toBe("keep me");
  });

  it("clients cannot forge a status_change row or another author", async () => {
    const f = await fixture("assignee_submits");
    const forged = await a1.client.from("node_updates").insert({
      node_id: f.t1, kind: "status_change", from_status: "todo", to_status: "verified",
    } as TablesInsert<"node_updates">);
    expect(forged.error).not.toBeNull();
    const asOwner = await a1.client.from("node_updates").insert({
      node_id: f.t1, kind: "comment", body: "as owner", user_id: owner.id,
    } as TablesInsert<"node_updates">);
    expect(asOwner.error).not.toBeNull();
    const { count } = await admin.from("node_updates").select("id", { count: "exact", head: true }).eq("node_id", f.t1);
    expect(count).toBe(0);
  });
});
