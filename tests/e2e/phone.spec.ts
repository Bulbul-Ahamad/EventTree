import { expect, test } from "@playwright/test";
import { pageFor } from "./helpers/auth";
import { apiAs, World } from "./helpers/world";

// US-18: the phone number is required, and only people who share an organization can see it.

const world = new World();
let slug = "";

test.beforeAll(async () => {
  const admin = await world.person("admin", "Ada Admin");
  const newbie = await world.person("newbie", "Nia Newbie", null); // no phone yet
  const stranger = await world.person("stranger", "Sam Stranger");
  const org = await world.org("Phone Club", [admin, newbie]);
  await world.org("Elsewhere Club", [stranger]);
  slug = org.slug;
});

test.afterAll(async () => {
  await world.cleanup();
});

test("a signed-in user without a phone must add one, then lands where they were going", async ({
  browser,
  baseURL,
}, testInfo) => {
  const n = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.who("newbie"));
  // Any page sends them to the form, remembering the page.
  await n.page.goto(`/o/${slug}/members`);
  await expect(n.page).toHaveURL(/\/complete-profile\?next=/);
  await n.page.goto("/settings/profile");
  await expect(n.page).toHaveURL(/\/complete-profile/);

  const phone = n.page.getByLabel("Phone number");
  await phone.fill("12345");
  await n.page.getByRole("button", { name: "Save and continue" }).click();
  await expect(n.page.getByText(/Enter a valid phone number/)).toBeVisible();
  await expect(n.page).toHaveURL(/\/complete-profile/);

  await phone.fill("01711 223344");
  await n.page.getByRole("button", { name: "Save and continue" }).click();
  await expect(n.page).toHaveURL(/\/settings\/profile/); // where they were going
  await expect(n.page.getByLabel("Phone number")).toHaveValue("+8801711223344");

  // With a phone, the gate page is pointless.
  await n.page.goto("/complete-profile");
  await expect(n.page).toHaveURL(/\/dashboard/);
  await n.context.close();
});

test("members of the same organization see the number; people elsewhere cannot read it", async ({
  browser,
  baseURL,
}, testInfo) => {
  const a = await pageFor(browser, testInfo, baseURL ?? "http://localhost:3000", world.who("admin"));
  await a.page.goto(`/o/${slug}/members`);
  // Tolerates the other test having saved the number a moment ago (both orders are fine).
  await expect(a.page.getByRole("row", { name: /Ada Admin/ })).toBeVisible();
  await expect(a.page.getByRole("row", { name: /Ada Admin/ })).toContainText("+8801700000000");
  await a.context.close();

  const api = await apiAs(world.who("stranger"));
  const res = await api.from("profiles").select("id, phone").eq("id", world.who("admin").id);
  expect(res.error).toBeNull();
  expect(res.data).toEqual([]); // not visible at all: no shared organization
});
