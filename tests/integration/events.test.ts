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

import { createEvent, deleteEvent, setEventStatus, updateEventSettings } from "@/features/events/actions";
import { getEvent, getEventContext, listEvents } from "@/features/events/queries";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let adm: Persona; // org admin, not assigned anywhere
let owner: Persona; // org member who creates events
let head: Persona; // org member assigned to a segment
let member: Persona; // org member, not assigned
let xena: Persona; // member of another org
let orgId: string;

const T1 = "2026-12-12T10:00:00.000Z";
const T2 = "2026-12-13T10:00:00.000Z";

async function expectFail(p: Promise<{ ok: boolean } & Record<string, unknown>>, code: string) {
  const r = await p;
  expect(r.ok, `expected ${code}`).toBe(false);
  expect(r.code).toBe(code);
}

async function newEvent(over: Record<string, unknown> = {}): Promise<string> {
  actAs(owner);
  const r = await createEvent({ orgId, title: "Int Event", startsAt: T1, endsAt: T2, ...over });
  if (!r.ok) throw new Error(`createEvent failed: ${r.code}`);
  return r.data.eventId;
}

beforeAll(async () => {
  [adm, owner, head, member, xena] = await Promise.all(
    ["adm", "owner", "head", "member", "xena"].map((n) => createPersona(n)),
  );

  actAs(adm);
  const slug = uniqueSlug();
  const created = await createOrganization({ name: "Int Events Org", slug, kind: "club" });
  if (!created.ok) throw new Error("create org failed");
  const { data: org } = await admin.from("organizations").select("id, join_code").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);
  for (const p of [owner, head, member]) {
    actAs(p);
    const j = await joinOrganization({ code: org!.join_code });
    if (!j.ok) throw new Error(`join failed for ${p.name}`);
  }
  actAs(xena);
  await createOrganization({ name: "Xena Org", slug: uniqueSlug("x"), kind: "club" });
  const { data: xo } = await admin.from("organizations").select("id").eq("name", "Xena Org").order("created_at", { ascending: false }).limit(1).single();
  trackOrg(xo!.id);
});

afterAll(cleanup);

describe("createEvent", () => {
  it("any org member creates a draft event and becomes its owner", async () => {
    const id = await newEvent({ title: "Tech Fest", description: "বর্ণনা", location: "Dhaka", reviewMode: "head_only" });
    actAs(owner);
    const e = await getEvent(id);
    expect(e).toMatchObject({
      title: "Tech Fest",
      description: "বর্ণনা",
      location: "Dhaka",
      status: "draft",
      reviewMode: "head_only",
      ownerId: owner.id,
      progress: 0,
    });
    const { data: em } = await admin.from("event_members").select("user_id").eq("event_id", id);
    expect(em?.map((r) => r.user_id)).toEqual([owner.id]);
  });

  it("defaults to Mode A and accepts missing optional fields", async () => {
    const id = await newEvent({ startsAt: undefined, endsAt: undefined });
    actAs(owner);
    expect(await getEvent(id)).toMatchObject({ reviewMode: "assignee_submits", startsAt: null, endsAt: null });
  });

  it("validates input: end before start, empty or too long title, bad id", async () => {
    actAs(owner);
    const r = await createEvent({ orgId, title: "X", startsAt: T2, endsAt: T1 });
    expect(!r.ok && r.code).toBe("E_VALIDATION");
    expect(!r.ok && r.fieldErrors?.endsAt).toBeTruthy();
    await expectFail(createEvent({ orgId, title: " " }), "E_VALIDATION");
    await expectFail(createEvent({ orgId, title: "a".repeat(201) }), "E_VALIDATION");
    await expectFail(createEvent({ orgId: "nope", title: "X" }), "E_VALIDATION");
  });

  it("someone outside the organization cannot create events in it", async () => {
    actAs(xena);
    await expectFail(createEvent({ orgId, title: "Sneaky" }), "E_NOT_AUTHORIZED");
  });

  it("stores HTML in titles as plain text", async () => {
    const id = await newEvent({ title: "<script>alert(1)</script>" });
    actAs(owner);
    expect((await getEvent(id))?.title).toBe("<script>alert(1)</script>");
  });
});

describe("visibility (BR-03, 404 policy)", () => {
  let eventId: string;
  beforeAll(async () => {
    eventId = await newEvent({ title: "Visibility Event" });
    // give `head` a segment so they become a participant
    const seg = await owner.client.rpc("create_node", {
      p_parent: eventId, p_type: "segment", p_title: "Venue", p_description: "",
      p_assignee: head.id, p_due_at: T2, p_priority: "medium", p_weight: 1,
    });
    expect(seg.error).toBeNull();
  });

  it("owner, an assigned head and the org admin can open it", async () => {
    for (const who of [owner, head, adm]) {
      actAs(who);
      expect((await getEvent(eventId))?.title, who.name).toBe("Visibility Event");
    }
  });

  it("an unassigned org member and another org's user get nothing", async () => {
    for (const who of [member, xena]) {
      actAs(who);
      expect(await getEvent(eventId), who.name).toBeNull();
      expect(await getEventContext(eventId), who.name).toBeNull();
    }
  });

  it("getEventContext reports the viewer's role facts", async () => {
    actAs(owner);
    expect(await getEventContext(eventId)).toMatchObject({ userId: owner.id, ownerId: owner.id, isOrgAdmin: false, isParticipant: true });
    actAs(head);
    expect(await getEventContext(eventId)).toMatchObject({ userId: head.id, ownerId: owner.id, isOrgAdmin: false, isParticipant: true });
    actAs(adm);
    expect(await getEventContext(eventId)).toMatchObject({ userId: adm.id, isOrgAdmin: true, isParticipant: false });
  });

  it("listEvents: participants see their events, the admin sees all, others none", async () => {
    actAs(adm);
    const all = (await listEvents(orgId, "active")).map((e) => e.id);
    expect(all).toContain(eventId);
    actAs(head);
    expect((await listEvents(orgId, "active")).map((e) => e.id)).toEqual([eventId]);
    actAs(member);
    expect(await listEvents(orgId, "active")).toEqual([]);
    actAs(xena);
    expect(await listEvents(orgId, "active")).toEqual([]);
  });
});

describe("updateEventSettings", () => {
  it("the owner edits title, description, dates, location and review mode", async () => {
    const id = await newEvent();
    actAs(owner);
    const r = await updateEventSettings({
      eventId: id, title: "Renamed", description: "New text", startsAt: T1, endsAt: T2,
      location: "Gazipur", reviewMode: "head_only",
    });
    expect(r.ok).toBe(true);
    expect(await getEvent(id)).toMatchObject({ title: "Renamed", description: "New text", location: "Gazipur", reviewMode: "head_only" });
  });

  it("clearing optional fields stores null", async () => {
    const id = await newEvent({ description: "x", location: "y" });
    actAs(owner);
    await updateEventSettings({ eventId: id, title: "Same", description: "", location: "" });
    expect(await getEvent(id)).toMatchObject({ description: null, location: null, startsAt: null, endsAt: null });
  });

  it("rejects end before start without changing anything", async () => {
    const id = await newEvent({ title: "Keep me" });
    actAs(owner);
    await expectFail(updateEventSettings({ eventId: id, title: "Changed", startsAt: T2, endsAt: T1 }), "E_VALIDATION");
    expect((await getEvent(id))?.title).toBe("Keep me");
  });

  it("a participant who is not the owner, and the org admin, cannot edit (BR-13)", async () => {
    const id = await newEvent();
    await owner.client.rpc("create_node", {
      p_parent: id, p_type: "segment", p_title: "S", p_description: "", p_assignee: head.id,
      p_due_at: T2, p_priority: "medium", p_weight: 1,
    });
    for (const who of [head, adm]) {
      actAs(who);
      await expectFail(updateEventSettings({ eventId: id, title: "Hacked" }), "E_NOT_AUTHORIZED");
    }
    actAs(owner);
    expect((await getEvent(id))?.title).toBe("Int Event");
  });

  it("someone who cannot see the event gets E_NOT_FOUND", async () => {
    const id = await newEvent();
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(updateEventSettings({ eventId: id, title: "Nope" }), "E_NOT_FOUND");
    }
  });

  it("title changes are refused once the event is completed (E_EVENT_READONLY)", async () => {
    const id = await newEvent();
    actAs(owner);
    await setEventStatus({ eventId: id, to: "active" });
    await setEventStatus({ eventId: id, to: "completed" });
    await expectFail(updateEventSettings({ eventId: id, title: "Late rename" }), "E_EVENT_READONLY");
  });
});

describe("setEventStatus lifecycle (02_AppFlow §6)", () => {
  it("walks draft > active > completed > active > completed > archived > completed", async () => {
    const id = await newEvent();
    actAs(owner);
    for (const to of ["active", "completed", "active", "completed", "archived", "completed"] as const) {
      expect((await setEventStatus({ eventId: id, to })).ok, to).toBe(true);
      expect((await getEvent(id))?.status).toBe(to);
    }
    expect((await getEvent(id))?.completedAt).not.toBeNull();
  });

  it("reopening clears completed_at", async () => {
    const id = await newEvent();
    actAs(owner);
    await setEventStatus({ eventId: id, to: "active" });
    await setEventStatus({ eventId: id, to: "completed" });
    await setEventStatus({ eventId: id, to: "active" });
    expect((await getEvent(id))?.completedAt).toBeNull();
  });

  it("skipping or repeating a state is E_INVALID_TRANSITION", async () => {
    const id = await newEvent();
    actAs(owner);
    await expectFail(setEventStatus({ eventId: id, to: "completed" }), "E_INVALID_TRANSITION");
    await expectFail(setEventStatus({ eventId: id, to: "archived" }), "E_INVALID_TRANSITION");
    await expectFail(setEventStatus({ eventId: id, to: "draft" }), "E_INVALID_TRANSITION");
    await expectFail(setEventStatus({ eventId: id, to: "bogus" }), "E_VALIDATION");
  });

  it("only the owner may change the status", async () => {
    const id = await newEvent();
    for (const who of [head, adm, member, xena]) {
      actAs(who);
      await expectFail(setEventStatus({ eventId: id, to: "active" }), "E_NOT_AUTHORIZED");
    }
    actAs(owner);
    expect((await getEvent(id))?.status).toBe("draft");
  });

  it("an unknown event is E_NOT_FOUND", async () => {
    actAs(owner);
    await expectFail(setEventStatus({ eventId: "11111111-1111-1111-1111-111111111111", to: "active" }), "E_NOT_FOUND");
  });

  it("completed events move between tabs", async () => {
    const id = await newEvent();
    actAs(owner);
    await setEventStatus({ eventId: id, to: "active" });
    expect((await listEvents(orgId, "active")).map((e) => e.id)).toContain(id);
    await setEventStatus({ eventId: id, to: "completed" });
    expect((await listEvents(orgId, "active")).map((e) => e.id)).not.toContain(id);
    expect((await listEvents(orgId, "completed")).map((e) => e.id)).toContain(id);
    await setEventStatus({ eventId: id, to: "archived" });
    expect((await listEvents(orgId, "archived")).map((e) => e.id)).toContain(id);
  });
});

describe("deleteEvent", () => {
  it("the owner can delete a draft event", async () => {
    const id = await newEvent();
    actAs(owner);
    expect((await deleteEvent({ eventId: id })).ok).toBe(true);
    expect(await getEvent(id)).toBeNull();
  });

  it("an archived event can be deleted; active and completed cannot", async () => {
    const id = await newEvent();
    actAs(owner);
    await setEventStatus({ eventId: id, to: "active" });
    await expectFail(deleteEvent({ eventId: id }), "E_EVENT_READONLY");
    await setEventStatus({ eventId: id, to: "completed" });
    await expectFail(deleteEvent({ eventId: id }), "E_EVENT_READONLY");
    await setEventStatus({ eventId: id, to: "archived" });
    expect((await deleteEvent({ eventId: id })).ok).toBe(true);
  });

  it("nobody else can delete it, and outsiders get E_NOT_FOUND", async () => {
    const id = await newEvent();
    await owner.client.rpc("create_node", {
      p_parent: id, p_type: "segment", p_title: "S", p_description: "", p_assignee: head.id,
      p_due_at: T2, p_priority: "medium", p_weight: 1,
    });
    for (const who of [head, adm]) {
      actAs(who);
      await expectFail(deleteEvent({ eventId: id }), "E_NOT_AUTHORIZED");
    }
    for (const who of [member, xena]) {
      actAs(who);
      await expectFail(deleteEvent({ eventId: id }), "E_NOT_FOUND");
    }
    actAs(owner);
    expect(await getEvent(id)).not.toBeNull();
  });

  it("deleting an event removes its whole subtree", async () => {
    const id = await newEvent();
    await owner.client.rpc("create_node", {
      p_parent: id, p_type: "segment", p_title: "S", p_description: "", p_assignee: head.id,
      p_due_at: T2, p_priority: "medium", p_weight: 1,
    });
    actAs(owner);
    await deleteEvent({ eventId: id });
    const { count } = await admin.from("nodes").select("id", { count: "exact", head: true }).eq("event_id", id);
    expect(count).toBe(0);
  });
});
