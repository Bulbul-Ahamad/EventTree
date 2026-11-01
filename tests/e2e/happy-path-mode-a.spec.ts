import { expect, test, type Page } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { World } from "./helpers/world";

// US-04..US-16, Mode A (assignees submit, managers verify), one story from start to finish:
// owner creates the event and a segment with a head -> head adds a task for a worker ->
// owner activates -> worker starts and submits -> head verifies -> progress is 100% ->
// owner completes the event and it is read-only afterwards.

const world = new World();
let org: { id: string; slug: string; name: string };
const EVENT = `Happy Event ${world.runId}`;
const SEGMENT = "Venue";
const TASK = "Hang the banner";

test.beforeAll(async () => {
  const owner = await world.person("owner", "Owen Owner");
  const head = await world.person("head", "Hana Head");
  const worker = await world.person("worker", "Wasi Worker");
  org = await world.org("Happy Club", [owner, head, worker]);
});

test.afterAll(async () => {
  await world.cleanup();
});

async function actionsMenu(page: Page, title: string) {
  await page.getByRole("button", { name: `Actions for ${title}` }).click();
}

async function pickAssignee(page: Page, name: string) {
  await page.getByRole("dialog").getByLabel("Assignee").click();
  await page.getByRole("option", { name }).click();
}

test("Mode A from an empty event to a completed, read-only one", async ({ browser, baseURL }, testInfo) => {
  const base = baseURL ?? "http://localhost:3000";
  const { owner, head, worker } = world.people;
  const slug = org.slug;

  const o = await pageFor(browser, testInfo, base, owner);
  const h = await pageFor(browser, testInfo, base, head);
  const w = await pageFor(browser, testInfo, base, worker);

  // Owner creates the event (starts as a draft) ...
  await o.page.goto(`/o/${slug}/events/new`);
  await o.page.getByLabel("Title").fill(EVENT);
  await o.page.getByRole("button", { name: "Create event" }).click();
  await o.page.waitForURL(/\/events\/[0-9a-f-]{36}/);
  const eventUrl = o.page.url();
  await expect(o.page.getByText("Draft — task updates are disabled until the owner activates the event.")).toBeVisible();

  // ... adds a segment and makes Hana its head.
  await o.page.getByRole("button", { name: "Add segment" }).click();
  await o.page.getByRole("dialog").getByLabel("Title").fill(SEGMENT);
  await pickAssignee(o.page, head.name);
  await o.page.getByRole("dialog").getByRole("button", { name: "Add segment" }).click();
  await expect(o.page.getByRole("treeitem", { name: new RegExp(SEGMENT) })).toBeVisible();

  // The head adds a task inside the segment and gives it to the worker.
  await h.page.goto(eventUrl);
  await actionsMenu(h.page, SEGMENT);
  await h.page.getByRole("menuitem", { name: "Add task" }).click();
  await h.page.getByRole("dialog").getByLabel("Title").fill(TASK);
  await pickAssignee(h.page, worker.name);
  await h.page.getByRole("dialog").getByRole("button", { name: "Add task" }).click();
  await expect(h.page.getByRole("treeitem", { name: new RegExp(TASK) })).toBeVisible();

  // The owner activates the event.
  await o.page.reload();
  await o.page.getByRole("button", { name: "Activate event" }).click();
  await o.page.getByRole("dialog").getByRole("button", { name: "Activate event" }).click();
  await expect(o.page.getByText("Draft — task updates are disabled until the owner activates the event.")).toBeHidden();

  // The worker starts the task and submits it for review.
  await w.page.goto(eventUrl);
  await actionsMenu(w.page, TASK);
  await w.page.getByRole("menuitem", { name: "Start" }).click();
  await actionsMenu(w.page, TASK);
  await w.page.getByRole("menuitem", { name: "Submit for review" }).click();
  await expect(w.page.getByRole("treeitem", { name: new RegExp(TASK) })).toContainText(/submitted|review/i);

  // The head verifies it with the tick button, and progress reaches 100%.
  await h.page.reload();
  await h.page.getByRole("button", { name: `Mark ${TASK} verified` }).click();
  await h.page.reload();
  await expect(h.page.getByRole("progressbar", { name: `${EVENT} overall progress` })).toHaveAttribute("aria-valuenow", "100");

  // The owner completes the event; from then on it is read-only.
  await o.page.reload();
  await o.page.getByRole("button", { name: "Mark completed" }).click();
  await o.page.getByRole("dialog").getByRole("button", { name: "Mark completed" }).click();
  await expect(o.page.getByText("This event is read-only.")).toBeVisible();
  await expect(o.page.getByRole("button", { name: "Mark completed" })).toBeHidden();
  await expect(o.page.getByRole("button", { name: `Actions for ${SEGMENT}` })).toBeHidden();

  await Promise.all([o.context.close(), h.context.close(), w.context.close()]);
});
