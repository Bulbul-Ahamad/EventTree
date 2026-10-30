// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actAs, cleanup, createPersona, trackOrg, uniqueSlug, admin, type Persona } from "./helpers/harness";
import { ANON_KEY, SUPABASE_URL } from "./helpers/env";

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

import { failFrom } from "@/lib/action-result";
import { ERROR_CODES, ERROR_MESSAGES, toErrorCode } from "@/lib/errors";
import { createEvent, setEventStatus } from "@/features/events/actions";
import { createNode, updateNode } from "@/features/nodes/actions";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";
import { addComment, transitionTask } from "@/features/updates/actions";
import type { Database } from "@/types/database";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

// Anything that looks like database or runtime internals.
const LEAKS = /relation|constraint|violates|syntax|sqlstate|pg_|postgres|schema|column|row-level|policy|function|enum|duplicate key|invalid input|permission denied|null value|foreign key|stack|at \w+\.\w+/i;
const CATALOGUE_MESSAGES = new Set<string>(Object.values(ERROR_MESSAGES));

let owner: Persona;
let outsider: Persona;
let orgId: string;
let eventId: string;
let segmentId: string;
let taskId: string;

function expectClean(r: { ok: boolean } & Record<string, unknown>, expectedCode?: string) {
  expect(r.ok).toBe(false);
  const message = String(r.message);
  expect(ERROR_CODES as readonly string[]).toContain(r.code);
  expect(CATALOGUE_MESSAGES.has(message), `message not from the catalogue: ${message}`).toBe(true);
  expect(message).not.toMatch(LEAKS);
  if (expectedCode) expect(r.code).toBe(expectedCode);
  expect(JSON.stringify(r)).not.toMatch(LEAKS);
}

beforeAll(async () => {
  [owner, outsider] = await Promise.all([createPersona("eowner"), createPersona("eoutsider")]);
  actAs(owner);
  const slug = uniqueSlug();
  await createOrganization({ name: "Int Errors Org", slug, kind: "club" });
  const { data: org } = await admin.from("organizations").select("id").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);
  const ev = await createEvent({ orgId, title: "Errors Event" });
  if (!ev.ok) throw new Error("createEvent failed");
  eventId = ev.data.eventId;
  const seg = await createNode({ parentId: eventId, type: "segment", title: "Seg", assigneeId: owner.id });
  const task = seg.ok ? await createNode({ parentId: seg.data.nodeId, type: "task", title: "Task", assigneeId: owner.id }) : seg;
  if (!seg.ok || !task.ok) throw new Error("fixture failed");
  segmentId = seg.data.nodeId;
  taskId = task.data.nodeId;
  actAs(outsider);
  await createOrganization({ name: "Outsider Errors Org", slug: uniqueSlug("o"), kind: "club" });
  const { data: oo } = await admin.from("organizations").select("id").eq("name", "Outsider Errors Org").order("created_at", { ascending: false }).limit(1).single();
  trackOrg(oo!.id);
});

afterAll(cleanup);

describe("raw Postgres/PostgREST errors never reach the message", () => {
  it("a check-constraint violation (weight 99) becomes E_UNKNOWN with the generic message", async () => {
    const { error } = await owner.client.from("nodes").update({ weight: 99 }).eq("id", taskId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(LEAKS); // the raw error really is technical
    const r = failFrom(error);
    expectClean(r, "E_UNKNOWN");
    expect(r.ok === false && r.message).toBe(ERROR_MESSAGES.E_UNKNOWN);
  });

  it("an invalid enum value sent straight to an RPC becomes E_UNKNOWN", async () => {
    const { error } = await owner.client.rpc("transition_task_status", {
      p_node: taskId,
      p_from: "todo",
      p_to: "bogus" as never,
      p_comment: null as unknown as string,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/invalid input|enum/i);
    expectClean(failFrom(error), "E_UNKNOWN");
  });

  it("a malformed uuid sent straight to an RPC becomes E_UNKNOWN", async () => {
    const { error } = await owner.client.rpc("get_event_tree", { p_event: "not-a-uuid" });
    expect(error).not.toBeNull();
    expectClean(failFrom(error), "E_UNKNOWN");
  });

  it("a foreign-key violation (assignee that does not exist) is E_UNKNOWN or an E_ code, never raw text", async () => {
    const { error } = await owner.client
      .from("nodes")
      .update({ assignee_id: "22222222-2222-2222-2222-222222222222" })
      .eq("id", taskId);
    expect(error).not.toBeNull();
    expectClean(failFrom(error));
  });

  it("an unknown table or column becomes E_UNKNOWN", async () => {
    const t = await owner.client.from("no_such_table" as never).select("*");
    expect(t.error).not.toBeNull();
    expectClean(failFrom(t.error), "E_UNKNOWN");
    const c = await owner.client.from("nodes").select("no_such_column" as never);
    expect(c.error).not.toBeNull();
    expectClean(failFrom(c.error), "E_UNKNOWN");
  });

  it("thrown values and non-error objects are handled too", () => {
    expectClean(failFrom(new Error('relation "nodes" does not exist')), "E_UNKNOWN");
    expectClean(failFrom({ message: "SELECT * FROM nodes", details: "secret", hint: "x", code: "42P01" }), "E_UNKNOWN");
    expectClean(failFrom(undefined), "E_UNKNOWN");
    expect(toErrorCode({ message: "TypeError: fetch failed" })).toBe("E_UNKNOWN");
  });
});

describe("RPC business errors map to their catalogue codes", () => {
  it("raised E_ codes arrive as the exact message and map one to one", async () => {
    actAs(owner);
    const stale = await owner.client.rpc("transition_task_status", { p_node: taskId, p_from: "done" as never, p_to: "todo", p_comment: null as unknown as string });
    expect(stale.error).not.toBeNull(); // invalid enum, not a catalogue code
    const eventNotActive = await owner.client.rpc("transition_task_status", { p_node: taskId, p_from: "todo", p_to: "in_progress", p_comment: null as unknown as string });
    expect(eventNotActive.error?.message).toBe("E_EVENT_NOT_ACTIVE");
    expect(toErrorCode(eventNotActive.error)).toBe("E_EVENT_NOT_ACTIVE");
    const notFound = await owner.client.rpc("transition_task_status", { p_node: "33333333-3333-3333-3333-333333333333", p_from: "todo", p_to: "in_progress", p_comment: null as unknown as string });
    expect(notFound.error?.message).toBe("E_NOT_FOUND");
  });

  it("each action surfaces catalogue messages only", async () => {
    actAs(owner);
    const results = [
      await transitionTask({ nodeId: taskId, from: "todo", to: "in_progress" }), // draft event
      await createNode({ parentId: taskId, type: "task", title: "x" }), // parent is a task
      await updateNode({ nodeId: "33333333-3333-3333-3333-333333333333", title: "x" }),
      await createNode({ parentId: segmentId, type: "task", title: "x", assigneeId: outsider.id }),
      await addComment({ nodeId: "33333333-3333-3333-3333-333333333333", body: "x" }),
      await createNode({ parentId: segmentId, type: "task", title: "" }), // validation
    ];
    const codes = results.map((r) => (r.ok ? "ok" : r.code));
    expect(codes).toEqual(["E_EVENT_NOT_ACTIVE", "E_PARENT_IS_TASK", "E_NOT_FOUND", "E_ASSIGNEE_NOT_IN_ORG", "E_NOT_FOUND", "E_VALIDATION"]);
    for (const r of results) expectClean(r);
  });
});

describe("permission refusals (SQLSTATE 42501) map to E_NOT_AUTHORIZED", () => {
  it("an RLS-refused insert", async () => {
    await setEventStatus({ eventId, to: "active" });
    const { error } = await outsider.client.from("node_updates").insert({ node_id: taskId, kind: "comment", body: "hi" } as never);
    expect(error).not.toBeNull();
    expectClean(failFrom(error), "E_NOT_AUTHORIZED");
  });

  it("calling an RPC without signing in (anon has no execute privilege)", async () => {
    const anon = createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.rpc("transition_task_status", { p_node: taskId, p_from: "todo", p_to: "in_progress", p_comment: null as unknown as string });
    expect(error).not.toBeNull();
    expectClean(failFrom(error), "E_NOT_AUTHORIZED");
  });

  it("writing a protected column directly (status is RPC-only)", async () => {
    const { error } = await owner.client.from("nodes").update({ status: "verified" } as never).eq("id", taskId);
    expect(error).not.toBeNull();
    expectClean(failFrom(error), "E_NOT_AUTHORIZED");
  });

  it("an outsider using actions gets not-found or not-authorized with clean messages", async () => {
    actAs(outsider);
    expectClean(await updateNode({ nodeId: taskId, title: "x" }), "E_NOT_FOUND");
    expectClean(await transitionTask({ nodeId: taskId, from: "todo", to: "in_progress" }), "E_NOT_FOUND");
    expectClean(await createNode({ parentId: segmentId, type: "task", title: "x" }), "E_NOT_AUTHORIZED");
    const j = await joinOrganization({ code: "WRONG-CODE" });
    expectClean(j, "E_INVALID_JOIN_CODE");
  });
});
