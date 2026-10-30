import { describe, expect, it } from "vitest";
import { mapAuthError } from "@/features/auth/map-error";
import {
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/features/auth/schemas";

const valid = { fullName: "Bulbul Ahamad", email: "Bulbul@Example.com ", password: "Passw0rd!demo" };

describe("signUpSchema", () => {
  it("accepts valid input and normalises the email", () => {
    const r = signUpSchema.safeParse(valid);
    expect(r.success && r.data.email).toBe("bulbul@example.com");
  });

  it("accepts Bangla names", () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: "বুলবুল আহমদ" }).success).toBe(true);
  });

  it("enforces name length 1-100", () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: "   " }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, fullName: "a".repeat(100) }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, fullName: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects bad emails", () => {
    for (const email of ["", "nope", "a@b", "a b@c.com"]) {
      expect(signUpSchema.safeParse({ ...valid, email }).success).toBe(false);
    }
  });

  it("enforces password: >= 10 chars, a letter and a digit", () => {
    const pw = (password: string) => signUpSchema.safeParse({ ...valid, password }).success;
    expect(pw("short1")).toBe(false);
    expect(pw("onlyletterslong")).toBe(false);
    expect(pw("1234567890123")).toBe(false);
    expect(pw("abcdefghi1")).toBe(true);
  });

  it("rejects unknown keys (strict)", () => {
    expect(signUpSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });
});

describe("other schemas", () => {
  it("signIn needs email and a non-empty password", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x", extra: 1 }).success).toBe(false);
  });

  it("emailOnly validates the email", () => {
    expect(emailOnlySchema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(emailOnlySchema.safeParse({ email: "bad" }).success).toBe(false);
  });

  it("resetPassword requires matching passwords and the password rule", () => {
    expect(resetPasswordSchema.safeParse({ password: "abcdefghi1", confirm: "abcdefghi1" }).success).toBe(true);
    const r = resetPasswordSchema.safeParse({ password: "abcdefghi1", confirm: "different" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(["confirm"]);
    expect(resetPasswordSchema.safeParse({ password: "short", confirm: "short" }).success).toBe(false);
  });
});

describe("mapAuthError (generic wording, no account enumeration)", () => {
  it("maps wrong password and unknown user to the same code", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toBe("E_INVALID_CREDENTIALS");
    expect(mapAuthError({ code: "user_not_found" })).toBe("E_INVALID_CREDENTIALS");
  });

  it("maps the known cases", () => {
    expect(mapAuthError({ code: "email_not_confirmed" })).toBe("E_EMAIL_NOT_CONFIRMED");
    expect(mapAuthError({ code: "user_already_exists" })).toBe("E_EMAIL_TAKEN");
    expect(mapAuthError({ code: "over_email_send_rate_limit" })).toBe("E_RATE_LIMIT");
    expect(mapAuthError({ status: 429 })).toBe("E_RATE_LIMIT");
    expect(mapAuthError({ code: "weak_password" })).toBe("E_VALIDATION");
    expect(mapAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe("E_NETWORK");
  });

  it("falls back to E_UNKNOWN", () => {
    expect(mapAuthError({ code: "something_new", message: "raw detail" })).toBe("E_UNKNOWN");
    expect(mapAuthError(null)).toBe("E_UNKNOWN");
  });
});

describe("updateProfileSchema", () => {
  it("trims and checks 1-100 characters", async () => {
    const { updateProfileSchema } = await import("@/features/auth/schemas");
    const r = updateProfileSchema.safeParse({ fullName: "  বুলবুল  " });
    expect(r.success && r.data.fullName).toBe("বুলবুল");
    expect(updateProfileSchema.safeParse({ fullName: " " }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ fullName: "a".repeat(101) }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ fullName: "ok", email: "x@y.co" }).success).toBe(false);
  });
});
