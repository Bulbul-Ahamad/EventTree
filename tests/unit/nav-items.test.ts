import { describe, expect, it } from "vitest";
import { isActivePath, navItemsFor, pickOrgSlug } from "@/components/shell/nav-items";

describe("navItemsFor", () => {
  it("shows only Dashboard when there is no organization", () => {
    expect(navItemsFor(null, false).map((i) => i.key)).toEqual(["dashboard"]);
  });

  it("shows Dashboard, Events, Members for a plain member", () => {
    const items = navItemsFor("acme", false);
    expect(items.map((i) => i.key)).toEqual(["dashboard", "events", "members"]);
    expect(items.map((i) => i.href)).toEqual(["/dashboard", "/o/acme/events", "/o/acme/members"]);
  });

  it("adds Org settings for admins only", () => {
    expect(navItemsFor("acme", true).map((i) => i.key)).toEqual(["dashboard", "events", "members", "settings"]);
    expect(navItemsFor("acme", true).at(-1)?.href).toBe("/o/acme/settings");
    expect(navItemsFor("acme", false).some((i) => i.key === "settings")).toBe(false);
  });

  it("encodes the slug in links", () => {
    expect(navItemsFor("a b", false)[1]?.href).toBe("/o/a%20b/events");
  });

  it("every item has a label", () => {
    for (const i of navItemsFor("acme", true)) expect(i.label.length).toBeGreaterThan(0);
  });
});

describe("isActivePath", () => {
  it("matches the path itself and anything below it", () => {
    expect(isActivePath("/o/acme/events", "/o/acme/events")).toBe(true);
    expect(isActivePath("/o/acme/events/123", "/o/acme/events")).toBe(true);
    expect(isActivePath("/o/acme/events/123/settings", "/o/acme/events")).toBe(true);
  });

  it("does not match siblings or look-alike prefixes", () => {
    expect(isActivePath("/o/acme/members", "/o/acme/events")).toBe(false);
    expect(isActivePath("/o/acme/events-archive", "/o/acme/events")).toBe(false);
    expect(isActivePath("/dashboard2", "/dashboard")).toBe(false);
    expect(isActivePath("/", "/dashboard")).toBe(false);
  });
});

describe("pickOrgSlug", () => {
  it("prefers the last used organization when it is still mine", () => {
    expect(pickOrgSlug(["a", "b", "c"], "b")).toBe("b");
  });

  it("falls back to the first organization", () => {
    expect(pickOrgSlug(["a", "b"], "gone")).toBe("a");
    expect(pickOrgSlug(["a", "b"], null)).toBe("a");
    expect(pickOrgSlug(["a", "b"], undefined)).toBe("a");
  });

  it("returns null when I have no organizations", () => {
    expect(pickOrgSlug([], "a")).toBeNull();
  });
});
