import { createServerClient } from "@supabase/ssr";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";
import { ANON_KEY, SUPABASE_URL } from "./env";
import { PASSWORD, type Person } from "./world";

type Cookie = { name: string; value: string };

// Signs in through the API (no login screen) and captures the very cookies the app's
// own Supabase client would set, so the browser starts out logged in.
export async function sessionCookies(person: Person): Promise<Cookie[]> {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: PASSWORD });
  if (error) throw new Error(`sign in ${person.email}: ${error.message}`);
  return [...jar].map(([name, value]) => ({ name, value }));
}

// Puts a logged-in session for `person` into a browser context. Use the test's own
// `context` fixture so the project's viewport (desktop or 360x740 mobile) applies; for a
// second user at the same time, make another context with browser.newContext(testInfo.project.use).
export async function loginAs(context: BrowserContext, baseURL: string, person: Person): Promise<void> {
  await context.addCookies((await sessionCookies(person)).map((c) => ({ ...c, url: baseURL })));
}

// A new, separate browser (own cookies) logged in as `person`, with the same viewport
// as the running project, so desktop and mobile runs both work with several users at once.
export async function pageFor(
  browser: Browser,
  testInfo: TestInfo,
  baseURL: string,
  person: Person,
): Promise<{ context: BrowserContext; page: Page }> {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor } = testInfo.project.use;
  const context = await browser.newContext({ baseURL, viewport, isMobile, hasTouch, userAgent, deviceScaleFactor });
  await loginAs(context, baseURL, person);
  return { context, page: await context.newPage() };
}
