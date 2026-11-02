import { describe, expect, it } from "vitest";
import { completeProfileSchema } from "@/features/auth/schemas";
import { isValidPhone, normalizePhone } from "@/lib/phone";

// 01_PRD US-18 AC2.
const ok = (raw: string) => {
  const n = normalizePhone(raw);
  return isValidPhone(n) ? n : null;
};

describe("phone numbers", () => {
  it("turns Bangladeshi numbers into +8801XXXXXXXXX", () => {
    expect(ok("01712345678")).toBe("+8801712345678");
    expect(ok("+8801712345678")).toBe("+8801712345678");
    expect(ok("8801712345678")).toBe("+8801712345678");
    expect(ok("008801712345678")).toBe("+8801712345678");
  });

  it("ignores spaces, dashes, dots and brackets", () => {
    expect(ok(" 01712-345 678 ")).toBe("+8801712345678");
    expect(ok("+880 (1712) 345.678")).toBe("+8801712345678");
  });

  it("accepts international numbers: + and 8 to 15 digits", () => {
    expect(ok("+14155552671")).toBe("+14155552671");
    expect(ok("+12345678")).toBe("+12345678"); // 8 digits
    expect(ok("+123456789012345")).toBe("+123456789012345"); // 15 digits
  });

  it("rejects everything else", () => {
    for (const bad of [
      "",
      "12345",
      "0171234567", // 10 digits
      "017123456789", // 12 digits
      "+88017123456", // too short for Bangladesh
      "+8802123456789", // +880 but not a mobile number
      "+1234567", // 7 digits
      "+1234567890123456", // 16 digits
      "+0123456789", // leading zero
      "abc12345678",
      "+88017abc45678",
      "017123456789a",
    ]) {
      expect(ok(bad), bad).toBeNull();
    }
  });

  it("is what the database check accepts (^\\+?[0-9]{8,15}$)", () => {
    for (const raw of ["01712345678", "+14155552671", "+12345678", " 8801712345678 "]) {
      expect(ok(raw)).toMatch(/^\+?[0-9]{8,15}$/);
    }
  });

  it("completeProfileSchema normalizes the number and keeps next", () => {
    const r = completeProfileSchema.safeParse({ phone: "01712345678", next: "/o/club" });
    expect(r.success && r.data).toEqual({ phone: "+8801712345678", next: "/o/club" });
    expect(completeProfileSchema.safeParse({ phone: "" }).success).toBe(false);
    expect(completeProfileSchema.safeParse({ phone: "01712345678", extra: 1 }).success).toBe(false);
  });
});
