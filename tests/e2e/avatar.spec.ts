import { expect, test } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { World } from "./helpers/world";

// US-18: upload, replace and remove a profile picture; it shows up around the app; bad files are refused.

const world = new World();
let slug = "";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeAll(async () => {
  const ada = await world.person("ada", "Ada Admin");
  const bo = await world.person("bo", "Bo Member");
  const org = await world.org("Photo Club", [ada, bo]);
  slug = org.slug;
});

test.afterAll(async () => {
  await world.cleanup();
});

test("upload, see it in the members list, replace, remove; bad files are refused", async ({ browser, baseURL }, testInfo) => {
  const url = baseURL ?? "http://localhost:3000";
  const a = await pageFor(browser, testInfo, url, world.who("ada"));
  const page = a.page;
  await page.goto("/settings/profile");
  const picker = page.getByLabel("Choose a profile picture");
  // Next.js has its own empty role=alert (route announcer), so pick ours by its text.
  const alert = (text: string) => page.getByRole("alert").filter({ hasText: text });

  // Wrong type: refused before anything is sent.
  await picker.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(alert("Use a JPG, PNG or WebP image.")).toBeVisible();

  // A text file dressed up as a PNG passes the browser check and is refused by the server.
  await picker.setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("not really an image") });
  await expect(alert("Use a JPG, PNG or WebP image.")).toBeVisible();

  // Over 2 MB: refused.
  await picker.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]) });
  await expect(alert("The image must be 2 MB or smaller.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);

  // A real picture.
  await picker.setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Profile picture of Ada Admin/ }).locator("img")).toBeVisible();

  // It shows in the members list for the other member too.
  const b = await pageFor(browser, testInfo, url, world.who("bo"));
  await b.page.goto(`/o/${slug}/members`);
  const row = b.page.getByRole("row", { name: /Ada Admin/ });
  await expect(row.locator("img")).toHaveCount(1);
  await expect(row.locator("img")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/avatars\//);

  // Replace it.
  await picker.setInputFiles({ name: "again.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();

  // Remove it: initials again.
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Profile picture of Ada Admin/ }).locator("img")).toHaveCount(0);
  await b.page.reload();
  await expect(b.page.getByRole("row", { name: /Ada Admin/ }).locator("img")).toHaveCount(0);

  await a.context.close();
  await b.context.close();
});
