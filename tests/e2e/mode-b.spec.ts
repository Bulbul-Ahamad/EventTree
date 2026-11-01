import { expect, test } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { World } from "./helpers/world";

// US-12, Mode B (managers tick tasks directly): the assignee has no way to submit, the head
// ticks tasks as verified straight from "To do" or "In progress", and progress follows.

const world = new World();
const EVENT = `Direct Event ${world.runId}`;
const ONE = "Print the posters";
const TWO = "Book the sound system";
let slug = "";
let eventId = "";

test.beforeAll(async () => {
  const owner = await world.person("owner", "Omar Owner");
  const head = await world.person("head", "Hira Head");
  const worker = await world.person("worker", "Wali Worker");
  const org = await world.org("Direct Club", [owner, head, worker]);
  slug = org.slug;
  eventId = await world.activeEvent({
    orgId: org.id,
    owner,
    title: EVENT,
    reviewMode: "head_only",
    segment: { title: "Publicity", head, tasks: [{ title: ONE, assignee: worker }, { title: TWO, assignee: worker }] },
  });
});

test.afterAll(async () => {
  await world.cleanup();
});

test("Mode B: the assignee cannot submit and the head ticks tasks directly", async ({ browser, baseURL }, testInfo) => {
  const base = baseURL ?? "http://localhost:3000";
  const eventUrl = `/o/${slug}/events/${eventId}`;
  const w = await pageFor(browser, testInfo, base, world.people.worker);
  const h = await pageFor(browser, testInfo, base, world.people.head);

  // The worker can start a task, but there is no Submit and no Verify, and no tick button.
  await w.page.goto(eventUrl);
  await w.page.getByRole("button", { name: `Actions for ${ONE}` }).click();
  await w.page.getByRole("menuitem", { name: "Start" }).click();
  await w.page.getByRole("button", { name: `Actions for ${ONE}` }).click();
  await expect(w.page.getByRole("menuitem", { name: "Move back to To do" })).toBeVisible();
  await expect(w.page.getByRole("menuitem", { name: "Submit for review" })).toHaveCount(0);
  await expect(w.page.getByRole("menuitem", { name: "Verify" })).toHaveCount(0);
  await w.page.keyboard.press("Escape");
  await expect(w.page.getByRole("button", { name: `Mark ${ONE} verified` })).toHaveCount(0);

  // The head ticks both tasks directly: one that is in progress, one that was never started.
  await h.page.goto(eventUrl);
  for (const title of [ONE, TWO]) {
    const answered = h.page.waitForResponse((r) => r.request().method() === "POST");
    await h.page.getByRole("button", { name: `Mark ${title} verified` }).click();
    await answered;
  }

  await expect(async () => {
    await h.page.reload();
    await expect(h.page.getByRole("progressbar", { name: `${EVENT} overall progress` })).toHaveAttribute(
      "aria-valuenow",
      "100",
      { timeout: 2000 },
    );
  }).toPass({ timeout: 15_000 });

  // Nothing is left to tick, and the worker sees both tasks as verified.
  await expect(h.page.getByRole("button", { name: /^Mark .* verified$/ })).toHaveCount(0);
  await w.page.reload();
  await expect(w.page.getByRole("treeitem", { name: new RegExp(ONE) })).toContainText(/verified/i);
  await expect(w.page.getByRole("treeitem", { name: new RegExp(TWO) })).toContainText(/verified/i);

  await Promise.all([w.context.close(), h.context.close()]);
});
