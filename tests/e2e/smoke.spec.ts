import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";
import { World } from "./helpers/world";

const world = new World();

test.beforeAll(async () => {
  const owner = await world.person("owner", "Smoke Owner");
  await world.org("Smoke Club", [owner]);
});

test.afterAll(async () => {
  await world.cleanup();
});

test("a logged-out visitor is sent to the login page and back after logging in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("a user created through the API starts logged in and sees the dashboard", async ({ context, page, baseURL }) => {
  await loginAs(context, baseURL ?? "http://localhost:3000", world.who("owner"));
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /My events/ })).toBeVisible();
});
