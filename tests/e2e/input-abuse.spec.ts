import { expect, test } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { admin, PASSWORD, World } from "./helpers/world";

// Plan 4.09, the browser side. Size limits, `javascript:` links and the `next` rules are also
// covered by unit and integration tests (see tests/EDGE_CASES.md and tests/RLS_ADVERSARIAL.md).
// Here: what a real browser does with hostile text and hostile redirects.

const world = new World();
const id = world.runId;
const HTML_TITLE = `<img src=x onerror=alert(1)> ${id}`;
const BOLD_TITLE = `<b>bold</b> <script>alert(2)</script> ${id}`;
const BANGLA_TITLE = `বাংলা কাজ 🎉 ${id}`;
let slug = "";
let eventId = "";
let taskId = "";

test.beforeAll(async () => {
  const owner = await world.person("owner", "Olek Owner");
  const org = await world.org("Abuse Club", [owner]);
  slug = org.slug;
  eventId = await world.activeEvent({
    orgId: org.id,
    owner,
    title: `Abuse Event ${id}`,
    reviewMode: "assignee_submits",
    segment: {
      title: `Segment ${id}`,
      head: owner,
      tasks: [
        { title: HTML_TITLE, assignee: owner },
        { title: BOLD_TITLE, assignee: owner },
        { title: BANGLA_TITLE, assignee: owner },
      ],
    },
  });
  taskId = await world.nodeId(HTML_TITLE);
  const history = await admin.from("node_updates").insert([
    { node_id: taskId, event_id: eventId, user_id: owner.id, kind: "proof_link", link_url: "https://example.com/proof", body: "<b>not bold</b>" },
    { node_id: taskId, event_id: eventId, user_id: owner.id, kind: "comment", body: "<img src=y onerror=alert(4)> কাজ শেষ ✅" },
  ]);
  if (history.error) throw new Error(history.error.message);
});

// The database itself refuses a proof link that is not http(s), whatever the app does.
test("the database refuses a javascript: proof link", async () => {
  const owner = world.who("owner");
  for (const link_url of ["javascript:alert(3)", "data:text/html,<script>alert(1)</script>", "ftp://example.com/x"]) {
    const res = await admin.from("node_updates").insert({ node_id: taskId, event_id: eventId, user_id: owner.id, kind: "proof_link", link_url });
    expect(res.error?.message, link_url).toMatch(/node_updates_link_url_check/);
  }
});

test.afterAll(async () => {
  await world.cleanup();
});

test("hostile and unusual titles are shown as plain text and nothing runs", async ({ browser, baseURL }, testInfo) => {
  const { context, page } = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.who("owner"));
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });

  await page.goto(`/o/${slug}/events/${eventId}`);
  await expect(page.getByText(HTML_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByText(BOLD_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByText(BANGLA_TITLE, { exact: true })).toBeVisible();
  const tree = page.getByRole("tree");
  await expect(tree.locator("img")).toHaveCount(0);
  await expect(tree.locator("b")).toHaveCount(0);
  await expect(tree.locator("script")).toHaveCount(0);
  expect(dialogs, "an alert() ran").toEqual([]);

  // The history of the task: links are only clickable when they are http(s); text stays text.
  await page.goto(`/o/${slug}/events/${eventId}?node=${taskId}`);
  const panel = page.getByRole("dialog");
  await expect(panel.locator('a[href^="javascript"]')).toHaveCount(0);
  const good = panel.getByRole("link", { name: "https://example.com/proof" });
  await expect(good).toHaveAttribute("rel", /noopener/);
  await expect(good).toHaveAttribute("target", "_blank");
  await expect(panel.getByText("<b>not bold</b>")).toBeVisible();
  await expect(panel.getByText("<img src=y onerror=alert(4)> কাজ শেষ ✅")).toBeVisible();
  await expect(panel.locator("img")).toHaveCount(0);
  await expect(panel.locator("b")).toHaveCount(0);
  expect(dialogs, "an alert() ran").toEqual([]);

  await context.close();
});

test("a hostile `next` after login never leaves the site", async ({ browser, baseURL }) => {
  const base = baseURL ?? "http://localhost:3000";
  const owner = world.who("owner");
  for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)"]) {
    const context = await browser.newContext({ baseURL: base });
    const page = await context.newPage();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("Email").fill(owner.email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    expect(new URL(page.url()).origin, `next=${next}`).toBe(new URL(base).origin);
    await context.close();
  }
});
