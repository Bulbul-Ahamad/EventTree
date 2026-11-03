import { expect, test, type Page } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { World } from "./helpers/world";

// US-11 AC1 and US-14: Send back and Reopen need a comment, and both show up in the history.

const world = new World();
const EVENT = `Review Event ${world.runId}`;
const TASK = "Design the poster";
const SEND_BACK_NOTE = "The date on the poster is wrong";
const REOPEN_NOTE = "Printer found a late mistake";
const REQUIRED = "Please add a comment explaining why.";
let slug = "";
let eventId = "";

test.beforeAll(async () => {
  const owner = await world.person("owner", "Olive Owner");
  const head = await world.person("head", "Hugo Head");
  const worker = await world.person("worker", "Wren Worker");
  const org = await world.org("Review Club", [owner, head, worker]);
  slug = org.slug;
  eventId = await world.activeEvent({
    orgId: org.id,
    owner,
    title: EVENT,
    reviewMode: "assignee_submits",
    segment: { title: "Print", head, tasks: [{ title: TASK, assignee: worker }] },
  });
});

test.afterAll(async () => {
  await world.cleanup();
});

async function runFromMenu(page: Page, item: string) {
  await page.getByRole("button", { name: `Actions for ${TASK}` }).click();
  const answered = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("menuitem", { name: item }).click();
  await answered;
}

// Send back / Reopen: first without a comment (refused), then with one.
async function withComment(page: Page, item: string, note: string) {
  await page.getByRole("button", { name: `Actions for ${TASK}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: item }).click();
  await expect(dialog.getByText(REQUIRED)).toBeVisible();
  await dialog.getByLabel("Comment").fill(note);
  const answered = page.waitForResponse((r) => r.request().method() === "POST");
  await dialog.getByRole("button", { name: item }).click();
  await answered;
  await expect(dialog).toBeHidden();
}

async function expectStatus(page: Page, status: RegExp) {
  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("treeitem", { name: new RegExp(TASK) })).toContainText(status, { timeout: 2000 });
  }).toPass({ timeout: 15_000 });
}

test("send back and reopen need a comment and are kept in the history", async ({ browser, baseURL }, testInfo) => {
  const base = baseURL ?? "http://localhost:3000";
  const eventUrl = `/o/${slug}/events/${eventId}`;
  const w = await pageFor(browser, testInfo, base, world.who("worker"));
  const h = await pageFor(browser, testInfo, base, world.who("head"));

  // The worker starts and submits the task.
  await w.page.goto(eventUrl);
  await runFromMenu(w.page, "Start");
  await runFromMenu(w.page, "Submit for review");

  // The head sends it back: no comment is refused, a comment goes through.
  await h.page.goto(eventUrl);
  await expectStatus(h.page, /submitted/i);
  await withComment(h.page, "Send back", SEND_BACK_NOTE);
  await expectStatus(h.page, /in progress/i);

  // The worker fixes it and submits again; the head verifies with the tick.
  await w.page.reload();
  await runFromMenu(w.page, "Submit for review");
  // No live updates: reload the head's page until it shows the second submission and the tick.
  const tick = h.page.getByRole("button", { name: `Mark ${TASK} verified` });
  await expect(async () => {
    await h.page.reload();
    await expect(tick).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  const verified = h.page.waitForResponse((r) => r.request().method() === "POST");
  await tick.click();
  await verified;
  await expectStatus(h.page, /verified/i);

  // Later the head reopens it: again a comment is required.
  await withComment(h.page, "Reopen", REOPEN_NOTE);
  await expectStatus(h.page, /in progress/i);

  // The history of the task shows both comments.
  await h.page.getByText(TASK, { exact: true }).click();
  const panel = h.page.getByRole("dialog");
  await expect(panel.getByText(SEND_BACK_NOTE)).toBeVisible();
  await expect(panel.getByText(REOPEN_NOTE)).toBeVisible();

  await Promise.all([w.context.close(), h.context.close()]);
});
