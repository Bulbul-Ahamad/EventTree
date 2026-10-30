import { describe, expect, it } from "vitest";
import { removeMemberSchema, rotateJoinCodeSchema, setMemberRoleSchema } from "@/features/orgs/schemas";
import { addCommentSchema, addProofLinkSchema, transitionTaskSchema } from "@/features/updates/schemas";

const ID = "40000000-0000-0000-0000-000000000001";
const ID2 = "00000000-0000-0000-0000-000000000002";

describe("addProofLinkSchema", () => {
  const link = (url: string) => addProofLinkSchema.safeParse({ nodeId: ID, url }).success;

  it("accepts http and https links", () => {
    expect(link("https://example.com/proof")).toBe(true);
    expect(link("http://example.com")).toBe(true);
    expect(link("HTTPS://EXAMPLE.COM")).toBe(true);
    expect(link("  https://example.com/a?b=1#c  ")).toBe(true);
  });

  it("rejects other schemes and malformed links", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>1</script>",
      "ftp://example.com",
      "file:///etc/passwd",
      "//example.com",
      "example.com",
      "https://",
      "https://exa mple.com",
      "https://example.com/ with space",
      "",
    ]) {
      expect(link(bad)).toBe(false);
    }
  });

  it("caps the length at 2000", () => {
    expect(link("https://example.com/" + "a".repeat(1980))).toBe(true);
    expect(link("https://example.com/" + "a".repeat(1990))).toBe(false);
  });
});

describe("addCommentSchema", () => {
  it("requires text, 1-2000 characters, plain", () => {
    expect(addCommentSchema.safeParse({ nodeId: ID, body: "  " }).success).toBe(false);
    expect(addCommentSchema.safeParse({ nodeId: ID, body: "a".repeat(2000) }).success).toBe(true);
    expect(addCommentSchema.safeParse({ nodeId: ID, body: "a".repeat(2001) }).success).toBe(false);
    expect(addCommentSchema.safeParse({ nodeId: ID, body: "কাজ শেষ হয়েছে ✅" }).success).toBe(true);
  });
});

describe("transitionTaskSchema", () => {
  const ok = { nodeId: ID, from: "in_progress", to: "submitted" };

  it("accepts a status change with an optional comment", () => {
    expect(transitionTaskSchema.safeParse(ok).success).toBe(true);
    expect(transitionTaskSchema.safeParse({ ...ok, comment: "Done" }).success).toBe(true);
  });

  it("rejects unknown statuses, no-op changes and long comments", () => {
    expect(transitionTaskSchema.safeParse({ ...ok, to: "done" }).success).toBe(false);
    expect(transitionTaskSchema.safeParse({ ...ok, from: "todo", to: "todo" }).success).toBe(false);
    expect(transitionTaskSchema.safeParse({ ...ok, comment: "a".repeat(2001) }).success).toBe(false);
  });

  it("does not decide which transitions are legal (the database does)", () => {
    expect(transitionTaskSchema.safeParse({ nodeId: ID, from: "todo", to: "verified" }).success).toBe(true);
  });
});

describe("org member schemas", () => {
  it("validate ids and role", () => {
    expect(rotateJoinCodeSchema.safeParse({ orgId: ID }).success).toBe(true);
    expect(setMemberRoleSchema.safeParse({ orgId: ID, userId: ID2, role: "admin" }).success).toBe(true);
    expect(setMemberRoleSchema.safeParse({ orgId: ID, userId: ID2, role: "owner" }).success).toBe(false);
    expect(removeMemberSchema.safeParse({ orgId: ID, userId: "x" }).success).toBe(false);
    expect(removeMemberSchema.safeParse({ orgId: ID, userId: ID2, extra: 1 }).success).toBe(false);
  });
});
