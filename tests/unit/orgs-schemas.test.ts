import { describe, expect, it } from "vitest";
import { createOrganizationSchema, joinOrganizationSchema } from "@/features/orgs/schemas";
import { slugify } from "@/features/orgs/slug";

describe("slugify", () => {
  it("makes a clean url name", () => {
    expect(slugify("DUET Computer Club")).toBe("duet-computer-club");
    expect(slugify("  Tech & Fest 2026!  ")).toBe("tech-fest-2026");
    expect(slugify("Café Society")).toBe("cafe-society");
  });

  it("gives an empty string for Bangla-only names", () => {
    expect(slugify("কম্পিউটার ক্লাব")).toBe("");
  });

  it("caps the length at 48 without a trailing dash", () => {
    const s = slugify("a".repeat(47) + " b");
    expect(s.length).toBeLessThanOrEqual(48);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("createOrganizationSchema", () => {
  const ok = { name: "DUET CSE Club", slug: "duet-cse", kind: "club" };

  it("accepts valid input", () => {
    expect(createOrganizationSchema.safeParse(ok).success).toBe(true);
  });

  it("checks name length 2-100", () => {
    expect(createOrganizationSchema.safeParse({ ...ok, name: "A" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ ...ok, name: "a".repeat(101) }).success).toBe(false);
  });

  it("checks the slug format and length 3-48", () => {
    for (const slug of ["ab", "Has-Caps", "double--dash", "-lead", "trail-", "has space", "a".repeat(49)]) {
      expect(createOrganizationSchema.safeParse({ ...ok, slug }).success).toBe(false);
    }
    expect(createOrganizationSchema.safeParse({ ...ok, slug: "abc" }).success).toBe(true);
  });

  it("only allows the four kinds and no extra keys", () => {
    expect(createOrganizationSchema.safeParse({ ...ok, kind: "company" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ ...ok, role: "admin" }).success).toBe(false);
  });
});

describe("joinOrganizationSchema", () => {
  it("trims, removes spaces and upper-cases", () => {
    const r = joinOrganizationSchema.safeParse({ code: "  ab12 cd34  " });
    expect(r.success && r.data.code).toBe("AB12CD34");
  });

  it("rejects an empty code", () => {
    expect(joinOrganizationSchema.safeParse({ code: "   " }).success).toBe(false);
  });
});
