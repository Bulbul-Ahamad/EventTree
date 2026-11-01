// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, cleanup, createPersona, trackOrg, uniqueSlug, type Persona } from "./helpers/harness";
import { ANON_KEY, SUPABASE_URL } from "./helpers/env";

// Plan 4.08. An attacker with a real login (or none) talks to PostgREST and the RPCs directly,
// around the app: reads, forged inserts, updates of protected columns, calls on foreign ids.
// Everything must be refused or come back empty, and the victim's data must not change.
// Results are summarised in tests/RLS_ADVERSARIAL.md.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const TABLES = ["profiles", "organizations", "org_members", "nodes", "event_settings", "event_members", "node_updates"] as const;

let owner: Persona; // event owner and organization admin
let head: Persona; // head of the segment
let worker: Persona; // assignee of the task
let plain: Persona; // member of the organization, not in the event
let xena: Persona; // member of another organization
let anon: SupabaseClient; // no login at all
let orgId = "";
let eventId = "";
let segId = "";
let taskId = "";
let xenaOrgId = "";

// "Blocked" = refused with an error, or accepted but touching no row.
function blocked(res: { error: unknown; data: unknown }): boolean {
  return res.error !== null || (Array.isArray(res.data) && res.data.length === 0) || res.data === null;
}

async function snapshot(): Promise<string> {
  const [nodes, settings, members, org, updates, evMembers] = await Promise.all([
    admin.from("nodes").select("*").eq("org_id", orgId).order("id"),
    admin.from("event_settings").select("*").eq("event_id", eventId),
    admin.from("org_members").select("*").eq("org_id", orgId).order("user_id"),
    admin.from("organizations").select("*").eq("id", orgId),
    admin.from("node_updates").select("*").eq("event_id", eventId).order("id"),
    admin.from("event_members").select("*").eq("event_id", eventId).order("user_id"),
  ]);
  return JSON.stringify([nodes.data, settings.data, members.data, org.data, updates.data, evMembers.data]);
}

let before = "";

beforeAll(async () => {
  [owner, head, worker, plain, xena] = await Promise.all(["owner", "head", "worker", "plain", "xena"].map((n) => createPersona(n)));
  anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const org = await admin.from("organizations").insert({ name: "Victim Club", slug: uniqueSlug("adv"), kind: "club", created_by: owner.id }).select("id").single();
  if (org.error) throw new Error(org.error.message);
  orgId = org.data.id;
  trackOrg(orgId);
  const other = await admin.from("organizations").insert({ name: "Attacker Club", slug: uniqueSlug("adv"), kind: "club", created_by: xena.id }).select("id").single();
  if (other.error) throw new Error(other.error.message);
  xenaOrgId = other.data.id;
  trackOrg(xenaOrgId);
  await admin.from("org_members").insert([
    { org_id: orgId, user_id: owner.id, role: "admin" },
    { org_id: orgId, user_id: head.id, role: "member" },
    { org_id: orgId, user_id: worker.id, role: "member" },
    { org_id: orgId, user_id: plain.id, role: "member" },
    { org_id: xenaOrgId, user_id: xena.id, role: "admin" },
  ]);

  const ev = await admin.from("nodes").insert({ org_id: orgId, type: "event", title: "Victim Event", assignee_id: owner.id, created_by: owner.id }).select("id").single();
  if (ev.error) throw new Error(ev.error.message);
  eventId = ev.data.id;
  await admin.from("event_settings").insert({ event_id: eventId, review_mode: "assignee_submits", event_status: "draft" });
  const seg = await admin.from("nodes").insert({ parent_id: eventId, type: "segment", title: "Victim Segment", assignee_id: head.id, created_by: owner.id }).select("id").single();
  if (seg.error) throw new Error(seg.error.message);
  segId = seg.data.id;
  const task = await admin.from("nodes").insert({ parent_id: segId, type: "task", title: "Victim Task", assignee_id: worker.id, created_by: owner.id }).select("id").single();
  if (task.error) throw new Error(task.error.message);
  taskId = task.data.id;
  await admin.from("event_settings").update({ event_status: "active" }).eq("event_id", eventId);
  await admin.from("node_updates").insert({ node_id: taskId, event_id: eventId, user_id: owner.id, kind: "comment", body: "first note" });

  before = await snapshot();
});

afterAll(async () => {
  await cleanup();
});

describe("no login at all (anon key)", () => {
  it("reads nothing from any table", async () => {
    for (const t of TABLES) expect(blocked(await anon.from(t).select("*")), `select ${t}`).toBe(true);
  });

  it("cannot call any RPC", async () => {
    const calls = [
      anon.rpc("get_event_tree", { p_event: eventId }),
      anon.rpc("get_my_tasks"),
      anon.rpc("get_review_queue"),
      anon.rpc("create_organization", { p_name: "x", p_slug: "x-adv", p_kind: "club" }),
      anon.rpc("join_org_by_code", { p_code: "AAAAAAAA" }),
      anon.rpc("rotate_join_code", { p_org: orgId }),
      anon.rpc("set_org_member_role", { p_org: orgId, p_user: plain.id, p_role: "admin" }),
      anon.rpc("remove_org_member", { p_org: orgId, p_user: head.id }),
      anon.rpc("set_event_status", { p_event: eventId, p_to: "archived" }),
      anon.rpc("transition_task_status", { p_node: taskId, p_from: "todo", p_to: "in_progress" }),
    ];
    for (const r of await Promise.all(calls)) expect(r.error, "rpc without login").not.toBeNull();
  });
});

describe("a user of another organization", () => {
  it("sees none of the victim's rows in any table", async () => {
    for (const t of TABLES) {
      const res = await xena.client.from(t).select("*");
      const rows = (res.data ?? []) as Record<string, unknown>[];
      const leaked = rows.filter((r) => [orgId, eventId, segId, taskId].some((id) => Object.values(r).includes(id)));
      expect(leaked, `rows of the victim visible in ${t}`).toHaveLength(0);
    }
    expect(blocked(await xena.client.from("organizations").select("join_code").eq("id", orgId))).toBe(true);
    expect((await xena.client.rpc("get_join_code", { p_org: orgId })).error).not.toBeNull();
    const tree = await xena.client.rpc("get_event_tree", { p_event: eventId });
    expect(tree.error !== null || (Array.isArray(tree.data) && tree.data.length === 0)).toBe(true);
  });

  it("cannot write with forged organization, event, status or author", async () => {
    const forgedNode = await xena.client.from("nodes").insert({
      org_id: orgId, event_id: eventId, parent_id: segId, type: "task", title: "forged", created_by: owner.id, status: "verified", path: "x", depth: 2,
    });
    expect(forgedNode.error, "forged node insert").not.toBeNull();
    const viaRpc = await xena.client.rpc("create_node", {
      p_parent: segId, p_type: "task", p_title: "forged", p_description: null, p_assignee: null, p_due_at: null, p_priority: "medium", p_weight: 1,
    });
    expect(viaRpc.error, "create_node under a foreign parent").not.toBeNull();
    const forgedComment = await xena.client.from("node_updates").insert({ node_id: taskId, event_id: eventId, user_id: owner.id, kind: "comment", body: "forged" });
    expect(forgedComment.error, "forged comment").not.toBeNull();
    const joinSelf = await xena.client.from("org_members").insert({ org_id: orgId, user_id: xena.id, role: "admin" });
    expect(joinSelf.error, "make myself admin").not.toBeNull();
    const intoEvent = await xena.client.from("event_members").insert({ event_id: eventId, user_id: xena.id });
    expect(intoEvent.error, "add myself to the event").not.toBeNull();
    const event = await xena.client.rpc("create_event", {
      p_org: orgId, p_title: "forged", p_description: null, p_starts_at: null, p_ends_at: null, p_location: null, p_review_mode: "assignee_submits",
    });
    expect(event.error, "create_event in a foreign organization").not.toBeNull();
  });

  it("cannot update or delete anything of the victim", async () => {
    expect(blocked(await xena.client.from("nodes").update({ title: "hacked" }).eq("id", taskId).select())).toBe(true);
    expect(blocked(await xena.client.from("nodes").delete().eq("id", eventId).select())).toBe(true);
    expect(blocked(await xena.client.from("organizations").update({ name: "hacked" }).eq("id", orgId).select())).toBe(true);
    expect(blocked(await xena.client.from("event_settings").update({ location: "hacked" }).eq("event_id", eventId).select())).toBe(true);
    expect(blocked(await xena.client.from("profiles").update({ full_name: "hacked" }).eq("id", owner.id).select())).toBe(true);
  });

  it("cannot use the RPCs on the victim's ids", async () => {
    const calls = [
      xena.client.rpc("rotate_join_code", { p_org: orgId }),
      xena.client.rpc("set_org_member_role", { p_org: orgId, p_user: xena.id, p_role: "admin" }),
      xena.client.rpc("remove_org_member", { p_org: orgId, p_user: owner.id }),
      xena.client.rpc("set_event_status", { p_event: eventId, p_to: "archived" }),
      xena.client.rpc("transition_task_status", { p_node: taskId, p_from: "todo", p_to: "in_progress" }),
    ];
    for (const r of await Promise.all(calls)) expect(r.error, "rpc on a foreign id").not.toBeNull();
  });

  it("gets the same answer for a wrong and a real-looking join code (no leak)", async () => {
    const a = await xena.client.rpc("join_org_by_code", { p_code: "ZZZZZZZZ" });
    const b = await xena.client.rpc("join_org_by_code", { p_code: "YYYYYYYY" });
    expect(a.error?.message).toBeDefined();
    expect(a.error?.message).toBe(b.error?.message);
  });
});

describe("a member of the organization who is not part of the event", () => {
  it("cannot read the event, its tree or its history", async () => {
    expect(blocked(await plain.client.from("nodes").select("id").eq("org_id", orgId))).toBe(true);
    expect(blocked(await plain.client.from("node_updates").select("id").eq("event_id", eventId))).toBe(true);
    expect(blocked(await plain.client.from("event_settings").select("*").eq("event_id", eventId))).toBe(true);
    const tree = await plain.client.rpc("get_event_tree", { p_event: eventId });
    expect(tree.error !== null || (Array.isArray(tree.data) && tree.data.length === 0)).toBe(true);
  });

  it("cannot read the join code, not through the table and not through get_join_code", async () => {
    const direct = await plain.client.from("organizations").select("join_code").eq("id", orgId);
    expect(direct.error, "select join_code as a member").not.toBeNull();
    const all = await plain.client.from("organizations").select("*").eq("id", orgId);
    expect(all.error, "select * includes the code").not.toBeNull();
    const name = await plain.client.from("organizations").select("id, name").eq("id", orgId);
    expect(name.data).toHaveLength(1); // the rest of the row stays readable
    expect((await plain.client.rpc("get_join_code", { p_org: orgId })).error).not.toBeNull();
    const real = await admin.from("organizations").select("join_code").eq("id", orgId).single();
    const asAdmin = await owner.client.rpc("get_join_code", { p_org: orgId });
    expect(asAdmin.error).toBeNull();
    expect(asAdmin.data).toBe(real.data?.join_code);
  });

  it("cannot write, promote themselves or touch other members", async () => {
    expect((await plain.client.from("nodes").insert({ parent_id: segId, type: "task", title: "forged" })).error).not.toBeNull();
    expect((await plain.client.from("node_updates").insert({ node_id: taskId, kind: "comment", body: "forged" })).error).not.toBeNull();
    expect(blocked(await plain.client.from("organizations").update({ name: "hacked" }).eq("id", orgId).select())).toBe(true);
    expect((await plain.client.rpc("set_org_member_role", { p_org: orgId, p_user: plain.id, p_role: "admin" })).error).not.toBeNull();
    expect((await plain.client.rpc("remove_org_member", { p_org: orgId, p_user: head.id })).error).not.toBeNull();
    expect((await plain.client.rpc("rotate_join_code", { p_org: orgId })).error).not.toBeNull();
    expect((await plain.client.rpc("set_event_status", { p_event: eventId, p_to: "completed" })).error).not.toBeNull();
    expect((await plain.client.rpc("transition_task_status", { p_node: taskId, p_from: "todo", p_to: "in_progress" })).error).not.toBeNull();
  });
});

describe("the assignee of a task, going around the app", () => {
  const PROTECTED = {
    status: "verified",
    progress_cached: 100,
    verified_by: "00000000-0000-0000-0000-000000000000",
    verified_at: "2026-01-01T00:00:00Z",
    submitted_at: "2026-01-01T00:00:00Z",
    event_id: "00000000-0000-0000-0000-000000000000",
    org_id: "00000000-0000-0000-0000-000000000000",
    created_by: "00000000-0000-0000-0000-000000000000",
    depth: 1,
    type: "segment",
    parent_id: "00000000-0000-0000-0000-000000000000",
  };

  it("cannot write any protected column of their own task", async () => {
    for (const [column, value] of Object.entries(PROTECTED)) {
      const res = await worker.client.from("nodes").update({ [column]: value }).eq("id", taskId).select();
      expect(blocked(res), `update ${column}`).toBe(true);
    }
  });

  it("cannot edit, reassign or delete the task (only managers can)", async () => {
    expect(blocked(await worker.client.from("nodes").update({ title: "hacked" }).eq("id", taskId).select())).toBe(true);
    expect(blocked(await worker.client.from("nodes").update({ assignee_id: plain.id }).eq("id", taskId).select())).toBe(true);
    expect(blocked(await worker.client.from("nodes").delete().eq("id", taskId).select())).toBe(true);
  });

  it("cannot change event settings or status, or add event members", async () => {
    expect((await worker.client.from("event_settings").update({ event_status: "archived" }).eq("event_id", eventId).select()).error).not.toBeNull();
    expect(blocked(await worker.client.from("event_settings").update({ location: "hacked" }).eq("event_id", eventId).select())).toBe(true);
    expect((await worker.client.from("event_members").insert({ event_id: eventId, user_id: worker.id })).error).not.toBeNull();
    expect((await worker.client.rpc("set_event_status", { p_event: eventId, p_to: "archived" })).error).not.toBeNull();
  });

  it("cannot forge the author, the event or a status change in the history", async () => {
    expect((await worker.client.from("node_updates").insert({ node_id: taskId, event_id: eventId, user_id: owner.id, kind: "comment", body: "as the owner" })).error).not.toBeNull();
    expect((await worker.client.from("node_updates").insert({ node_id: taskId, kind: "status_change", body: "fake", from_status: "todo", to_status: "verified" })).error).not.toBeNull();
  });

  it("cannot edit or delete history", async () => {
    expect((await worker.client.from("node_updates").update({ body: "rewritten" }).eq("node_id", taskId).select()).error).not.toBeNull();
    expect((await worker.client.from("node_updates").delete().eq("node_id", taskId).select()).error).not.toBeNull();
  });

  it("cannot promote themselves, remove others or read the join code of another organization", async () => {
    expect((await worker.client.rpc("set_org_member_role", { p_org: orgId, p_user: worker.id, p_role: "admin" })).error).not.toBeNull();
    expect((await worker.client.rpc("remove_org_member", { p_org: orgId, p_user: owner.id })).error).not.toBeNull();
    expect(blocked(await worker.client.from("organizations").select("join_code").eq("id", xenaOrgId))).toBe(true);
  });
});

describe("after all attacks", () => {
  it("the victim's data is exactly as it was", async () => {
    expect(await snapshot()).toBe(before);
  });
});
