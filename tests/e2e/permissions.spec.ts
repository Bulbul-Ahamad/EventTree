import { expect, test, type Page } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { admin, apiAs, World } from "./helpers/world";

// 01_PRD §7 (permission matrix), checked twice: what the screen offers, and what the
// database says when the API is called directly with each person's own login.

const world = new World();
const id = world.runId;
const EVENT = `Rules Event ${id}`;
const S1 = `Stage ${id}`;
const S2 = `Sound ${id}`;
const T1 = `Build stage ${id}`; // in S1, assigned to the worker, already submitted
const T2 = `Mic check ${id}`; // in S2, assigned to head2
let slug = "";
let eventId = "";
let t1 = "";
let s1 = "";

test.beforeAll(async () => {
  const orgAdmin = await world.person("admin", "Ada Admin");
  const owner = await world.person("owner", "Omar Owner");
  const head1 = await world.person("head1", "Hana One");
  const head2 = await world.person("head2", "Hugo Two");
  const worker = await world.person("worker", "Wren Worker");
  await world.person("plain", "Pia Plain");
  const xena = await world.person("xena", "Xena Elsewhere");
  const org = await world.org("Rules Club", [orgAdmin, owner, head1, head2, worker, world.people.plain]);
  await world.org("Other Club", [xena]);
  slug = org.slug;
  eventId = await world.activeEvent({
    orgId: org.id,
    owner,
    title: EVENT,
    reviewMode: "assignee_submits",
    segment: { title: S1, head: head1, tasks: [{ title: T1, assignee: worker, status: "submitted" }] },
    more: [{ title: S2, head: head2, tasks: [{ title: T2, assignee: head2 }] }],
  });
  t1 = await world.nodeId(T1);
  s1 = await world.nodeId(S1);
});

test.afterAll(async () => {
  await world.cleanup();
});

const eventUrl = () => `/o/${slug}/events/${eventId}`;
const anyActions = (page: Page) => page.getByRole("button", { name: /^Actions for / });
const anyTick = (page: Page) => page.getByRole("button", { name: /^Mark .* verified$/ });

test.describe("what the screen offers", () => {
  test("the assignee of a submitted task cannot verify or send it back", async ({ browser, baseURL }, testInfo) => {
    const w = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.people.worker);
    await w.page.goto(eventUrl());
    await expect(w.page.getByRole("treeitem", { name: new RegExp(T1) })).toBeVisible();
    await expect(anyTick(w.page)).toHaveCount(0);
    // Their own row has no menu at all: nothing is left to do on a submitted task.
    await expect(w.page.getByRole("button", { name: `Actions for ${T1}` })).toHaveCount(0);
    await w.context.close();
  });

  test("a head cannot touch the sibling segment", async ({ browser, baseURL }, testInfo) => {
    const h = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.people.head2);
    await h.page.goto(eventUrl());
    await expect(h.page.getByRole("treeitem", { name: new RegExp(T1) })).toBeVisible(); // visible (BR-03) ...
    await expect(h.page.getByRole("button", { name: `Actions for ${S1}` })).toHaveCount(0); // ... but read-only
    await expect(h.page.getByRole("button", { name: `Actions for ${T1}` })).toHaveCount(0);
    await expect(h.page.getByRole("button", { name: `Mark ${T1} verified` })).toHaveCount(0);
    await expect(h.page.getByRole("button", { name: `Actions for ${S2}` })).toBeVisible(); // their own segment works
    await h.context.close();
  });

  test("an organization admin who is not assigned can only look", async ({ browser, baseURL }, testInfo) => {
    const a = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.people.admin);
    await a.page.goto(eventUrl());
    await expect(a.page.getByRole("heading", { level: 1, name: EVENT })).toBeVisible();
    await expect(a.page.getByRole("treeitem", { name: new RegExp(T1) })).toBeVisible();
    await expect(anyActions(a.page)).toHaveCount(0);
    await expect(anyTick(a.page)).toHaveCount(0);
    await expect(a.page.getByRole("button", { name: "Mark completed" })).toHaveCount(0);
    await expect(a.page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await a.context.close();
  });

  test("a member who is not part of the event, and a user of another organization, get a 404", async ({ browser, baseURL }, testInfo) => {
    for (const who of [world.people.plain, world.people.xena]) {
      const p = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", who);
      await p.page.goto(eventUrl());
      await expect(p.page.getByText("We couldn't find that page.")).toBeVisible();
      await expect(p.page.getByText(T1)).toHaveCount(0);
      await p.context.close();
    }
  });
});

test.describe("what the database says to direct API calls", () => {
  test("the assignee cannot verify, edit or comment around the UI", async () => {
    const api = await apiAs(world.people.worker);
    const verify = await api.rpc("transition_task_status", { p_node: t1, p_from: "submitted", p_to: "verified", p_comment: null });
    expect(verify.error, "verify by the assignee").not.toBeNull();
    const direct = await api.from("nodes").update({ status: "verified", title: "hacked" }).eq("id", t1).select();
    expect(direct.data ?? []).toHaveLength(0);
    const after = await admin.from("nodes").select("status,title").eq("id", t1).single();
    expect(after.data).toMatchObject({ status: "submitted", title: T1 });
  });

  test("a head cannot create or verify anything in the sibling segment", async () => {
    const api = await apiAs(world.people.head2);
    const create = await api.rpc("create_node", {
      p_parent: s1, p_type: "task", p_title: "sneaky", p_description: null, p_assignee: null, p_due_at: null, p_priority: "medium", p_weight: 1,
    });
    expect(create.error, "create under a sibling segment").not.toBeNull();
    const verify = await api.rpc("transition_task_status", { p_node: t1, p_from: "submitted", p_to: "verified", p_comment: null });
    expect(verify.error, "verify in a sibling segment").not.toBeNull();
  });

  test("an unassigned organization admin cannot write", async () => {
    const api = await apiAs(world.people.admin);
    expect((await api.from("nodes").select("id").eq("id", t1)).data).toHaveLength(1); // may look
    const verify = await api.rpc("transition_task_status", { p_node: t1, p_from: "submitted", p_to: "verified", p_comment: null });
    expect(verify.error, "verify by an org admin").not.toBeNull();
    const create = await api.rpc("create_node", {
      p_parent: s1, p_type: "task", p_title: "sneaky", p_description: null, p_assignee: null, p_due_at: null, p_priority: "medium", p_weight: 1,
    });
    expect(create.error, "create by an org admin").not.toBeNull();
    const settings = await api.from("event_settings").update({ event_status: "archived" }).eq("event_id", eventId).select();
    expect(settings.data ?? []).toHaveLength(0);
  });

  test("a non-participant and another organization's user see nothing and change nothing", async () => {
    for (const who of [world.people.plain, world.people.xena]) {
      const api = await apiAs(who);
      expect((await api.from("nodes").select("id").eq("id", t1)).data ?? []).toHaveLength(0);
      expect((await api.from("nodes").select("id").eq("id", eventId)).data ?? []).toHaveLength(0);
      const tree = await api.rpc("get_event_tree", { p_event: eventId });
      expect(tree.error !== null || (Array.isArray(tree.data) && tree.data.length === 0), "get_event_tree").toBe(true);
      const verify = await api.rpc("transition_task_status", { p_node: t1, p_from: "submitted", p_to: "verified", p_comment: null });
      expect(verify.error, "verify by a non-participant").not.toBeNull();
    }
    const after = await admin.from("nodes").select("status").eq("id", t1).single();
    expect(after.data?.status).toBe("submitted");
  });
});
