import { describe, expect, it } from "vitest";
import {
  decideRoute,
  needsOrgCount,
  needsPhoneCheck,
  sanitizeNext,
  type GuardInput,
} from "@/lib/route-guards";

const base: GuardInput = {
  pathname: "/",
  search: "",
  hasSession: false,
  orgCount: null,
  allowDev: false,
};
const go = (over: Partial<GuardInput>) => decideRoute({ ...base, ...over });
const redirect = (to: string) => ({ type: "redirect", to });
const next = { type: "next" };

describe("sanitizeNext (rule 8)", () => {
  it("accepts same-origin relative paths", () => {
    expect(sanitizeNext("/dashboard")).toBe("/dashboard");
    expect(sanitizeNext("/o/club/events/1?node=2&filter=mine")).toBe(
      "/o/club/events/1?node=2&filter=mine",
    );
  });

  it("rejects everything else", () => {
    for (const bad of [
      "//evil.com",
      "///evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "https://evil.com",
      "http://evil.com/x",
      "javascript:alert(1)",
      "dashboard",
      "/ok\nLocation: x",
      "/a\tb",
      "",
      null,
      undefined,
    ]) {
      expect(sanitizeNext(bad)).toBeNull();
    }
  });
});

describe("guests", () => {
  it("can open public and guest-only pages", () => {
    for (const pathname of ["/", "/login", "/signup", "/signup/check-email", "/forgot-password", "/auth/callback"]) {
      expect(go({ pathname })).toEqual(next);
    }
  });

  it("are sent to /login with the original path and query (rule 1)", () => {
    expect(go({ pathname: "/dashboard" })).toEqual(redirect("/login?next=%2Fdashboard"));
    expect(go({ pathname: "/o/club/events/1", search: "?node=2" })).toEqual(
      redirect("/login?next=%2Fo%2Fclub%2Fevents%2F1%3Fnode%3D2"),
    );
    expect(go({ pathname: "/onboarding" })).toEqual(redirect("/login?next=%2Fonboarding"));
  });

  it("cannot open /reset-password without a recovery session", () => {
    expect(go({ pathname: "/reset-password" })).toEqual(redirect("/forgot-password"));
  });

  it("can open /dev only outside production", () => {
    expect(go({ pathname: "/dev/tokens", allowDev: true })).toEqual(next);
    expect(go({ pathname: "/dev/tokens", allowDev: false })).toEqual(
      redirect("/login?next=%2Fdev%2Ftokens"),
    );
  });
});

describe("signed-in users", () => {
  const s = { hasSession: true };

  it("go to /dashboard from / and guest-only pages (rule 2)", () => {
    for (const pathname of ["/", "/login", "/signup", "/signup/check-email", "/forgot-password"]) {
      expect(go({ ...s, pathname, orgCount: 1 })).toEqual(redirect("/dashboard"));
    }
  });

  it("with 0 orgs are forced to /onboarding (rule 3)", () => {
    for (const pathname of ["/dashboard", "/o/club/events", "/o/club/members"]) {
      expect(go({ ...s, pathname, orgCount: 0 })).toEqual(redirect("/onboarding"));
    }
  });

  it("with 0 orgs may still open the exempt pages", () => {
    for (const pathname of ["/onboarding", "/settings/profile", "/auth/callback", "/reset-password"]) {
      expect(go({ ...s, pathname, orgCount: 0 })).toEqual(next);
    }
  });

  it("with orgs may use the app and /onboarding (rule 4)", () => {
    for (const pathname of ["/dashboard", "/onboarding", "/o/club/events", "/settings/profile"]) {
      expect(go({ ...s, pathname, orgCount: 2 })).toEqual(next);
    }
  });

  it("are not redirected when the org count is unknown", () => {
    expect(go({ ...s, pathname: "/dashboard", orgCount: null })).toEqual(next);
  });
});

describe("needsOrgCount", () => {
  it("only asks the database when the answer can change the decision", () => {
    const q = (pathname: string, hasSession = true) =>
      needsOrgCount({ pathname, search: "", hasSession, allowDev: false });
    expect(q("/dashboard")).toBe(true);
    expect(q("/o/club/events")).toBe(true);
    expect(q("/dashboard", false)).toBe(false);
    expect(q("/")).toBe(false);
    expect(q("/login")).toBe(false);
    expect(q("/onboarding")).toBe(false);
    expect(q("/settings/profile")).toBe(false);
  });
});

describe("rule 3a: phone number (US-18)", () => {
  const signedIn = { hasSession: true, orgCount: 1 };

  it("sends a signed-in user without a phone to /complete-profile, remembering where they were going", () => {
    expect(go({ ...signedIn, pathname: "/dashboard", hasPhone: false })).toEqual(redirect("/complete-profile"));
    expect(go({ ...signedIn, pathname: "/o/club/events/1", search: "?node=2", hasPhone: false })).toEqual(
      redirect("/complete-profile?next=%2Fo%2Fclub%2Fevents%2F1%3Fnode%3D2"),
    );
    expect(go({ ...signedIn, pathname: "/settings/profile", hasPhone: false })).toEqual(
      redirect("/complete-profile?next=%2Fsettings%2Fprofile"),
    );
  });

  it("happens before the no-organization redirect", () => {
    expect(go({ hasSession: true, orgCount: 0, pathname: "/dashboard", hasPhone: false })).toEqual(
      redirect("/complete-profile"),
    );
  });

  it("lets /complete-profile and /auth through, and keeps people with a phone out of /complete-profile", () => {
    expect(go({ ...signedIn, pathname: "/complete-profile", hasPhone: false })).toEqual(next);
    expect(go({ ...signedIn, pathname: "/auth/callback", hasPhone: false })).toEqual(next);
    expect(go({ ...signedIn, pathname: "/reset-password", hasPhone: false })).toEqual(next);
    expect(go({ ...signedIn, pathname: "/complete-profile", hasPhone: true })).toEqual(redirect("/dashboard"));
  });

  it("does nothing when the phone is present or unknown", () => {
    expect(go({ ...signedIn, pathname: "/dashboard", hasPhone: true })).toEqual(next);
    expect(go({ ...signedIn, pathname: "/dashboard", hasPhone: null })).toEqual(next);
    expect(go({ ...signedIn, pathname: "/dashboard" })).toEqual(next);
  });

  it("guests are untouched, and /complete-profile needs a login", () => {
    expect(go({ pathname: "/complete-profile" })).toEqual(redirect("/login?next=%2Fcomplete-profile"));
  });

  it("needsPhoneCheck skips guests, the home page, guest-only pages and auth routes", () => {
    const q = (pathname: string, hasSession = true) =>
      needsPhoneCheck({ pathname, search: "", hasSession, allowDev: false });
    expect(q("/dashboard")).toBe(true);
    expect(q("/complete-profile")).toBe(true);
    expect(q("/dashboard", false)).toBe(false);
    expect(q("/")).toBe(false);
    expect(q("/login")).toBe(false);
    expect(q("/auth/callback")).toBe(false);
    expect(q("/reset-password")).toBe(false);
  });

  it("/complete-profile does not need the organization count", () => {
    expect(needsOrgCount({ pathname: "/complete-profile", search: "", hasSession: true, allowDev: false })).toBe(false);
  });
});
