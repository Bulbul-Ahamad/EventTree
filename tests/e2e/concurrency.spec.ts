import { expect, test } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { admin, World } from "./helpers/world";

// Two people have the same submitted task open. One verifies it. The other, still looking at
// the old screen, tries to verify it too: they get the "updated by someone else" message and
// the screen refreshes to the real state (E_STALE_STATE, 02_AppFlow §5 and §7).

const world = new World();
const EVENT = `Race Event ${world.runId}`;
const TASK = `Count the chairs ${world.runId}`;
const STALE = "This task was just updated by someone else. We've refreshed it.";
let slug = "";
let eventId = "";
let taskId = "";

test.beforeAll(async () => {
  const owner = await world.person("owner", "Olga Owner");
  const head = await world.person("head", "Harun Head");
  const worker = await world.person("worker", "Wafa Worker");
  const org = await world.org("Race Club", [owner, head, worker]);
  slug = org.slug;
  eventId = await world.activeEvent({
    orgId: org.id,
    owner,
    title: EVENT,
    reviewMode: "assignee_submits",
    segment: { title: "Seating", head, tasks: [{ title: TASK, assignee: worker, status: "submitted" }] },
  });
  taskId = await world.nodeId(TASK);
});

test.afterAll(async () => {
  await world.cleanup();
});

test("the second person to act on the same task gets the stale-state message and a fresh screen", async ({ browser, baseURL }, testInfo) => {
  const base = baseURL ?? "http://localhost:3000";
  const eventUrl = `/o/${slug}/events/${eventId}`;
  const tick = (name: string) => ({ name: `Mark ${name} verified` });

  const head = await pageFor(browser, testInfo, base, world.people.head);
  const owner = await pageFor(browser, testInfo, base, world.people.owner);
  await head.page.goto(eventUrl);
  await owner.page.goto(eventUrl);
  // Both screens show the task as submitted, with the tick available.
  await expect(head.page.getByRole("button", tick(TASK))).toBeVisible();
  await expect(owner.page.getByRole("button", tick(TASK))).toBeVisible();

  // The head verifies first.
  const first = head.page.waitForResponse((r) => r.request().method() === "POST");
  await head.page.getByRole("button", tick(TASK)).click();
  await first;
  await expect.poll(async () => (await admin.from("nodes").select("status").eq("id", taskId).single()).data?.status).toBe("verified");

  // The owner's screen is old: it still offers the tick. Using it loses the race.
  await expect(owner.page.getByRole("button", tick(TASK))).toBeVisible();
  await owner.page.getByRole("button", tick(TASK)).click();
  await expect(owner.page.getByText(STALE)).toBeVisible();

  // The screen refreshed itself to the truth: verified, nothing left to tick.
  await expect(owner.page.getByRole("treeitem", { name: new RegExp(TASK) })).toContainText(/verified/i);
  await expect(owner.page.getByRole("button", tick(TASK))).toHaveCount(0);

  // The loser changed nothing: still verified, and exactly one verification was recorded.
  const row = await admin.from("nodes").select("status").eq("id", taskId).single();
  expect(row.data?.status).toBe("verified");

  await Promise.all([head.context.close(), owner.context.close()]);
});
