import { describe, expect, it } from "vitest";
import { fail, failFrom, ok } from "@/lib/action-result";
import {
  ERROR_CODES,
  ERROR_MESSAGES,
  errorMessage,
  isErrorCode,
  toErrorCode,
} from "@/lib/errors";

// The 21 codes of docs/02_AppFlow.md §7.
const CATALOGUE = [
  "E_NOT_AUTHORIZED", "E_NOT_FOUND", "E_INVALID_TRANSITION", "E_STALE_STATE",
  "E_COMMENT_REQUIRED", "E_EVENT_NOT_ACTIVE", "E_EVENT_READONLY",
  "E_ASSIGNEE_NOT_IN_ORG", "E_INVALID_JOIN_CODE", "E_SLUG_TAKEN", "E_LAST_ADMIN",
  "E_OWNS_EVENTS", "E_MAX_DEPTH", "E_PARENT_IS_TASK", "E_NODE_LIMIT",
  "E_ROOT_IMMUTABLE", "E_EMAIL_TAKEN", "E_VALIDATION", "E_RATE_LIMIT",
  "E_NETWORK", "E_UNKNOWN",
];

describe("error catalogue", () => {
  it("contains exactly the codes of 02_AppFlow §7", () => {
    expect([...ERROR_CODES].sort()).toEqual([...CATALOGUE].sort());
  });

  it("has a non-empty message for every code", () => {
    for (const code of ERROR_CODES) {
      expect(errorMessage(code).length).toBeGreaterThan(0);
    }
  });

  it("uses the exact wording for a few key codes", () => {
    expect(ERROR_MESSAGES.E_INVALID_JOIN_CODE).toBe("Invalid or expired code.");
    expect(ERROR_MESSAGES.E_EMAIL_TAKEN).toBe(
      "An account with this email may already exist. Try logging in.",
    );
  });
});

describe("toErrorCode", () => {
  it("maps every known code", () => {
    for (const code of ERROR_CODES) expect(toErrorCode(code)).toBe(code);
  });

  it("reads error.message and trims whitespace", () => {
    expect(toErrorCode({ message: " E_STALE_STATE " })).toBe("E_STALE_STATE");
  });

  it("maps unknown or raw SQL text to E_UNKNOWN", () => {
    expect(toErrorCode("E_SOMETHING_NEW")).toBe("E_UNKNOWN");
    expect(toErrorCode('duplicate key value violates unique constraint "x"')).toBe("E_UNKNOWN");
    expect(toErrorCode(null)).toBe("E_UNKNOWN");
    expect(toErrorCode(undefined)).toBe("E_UNKNOWN");
    expect(toErrorCode(42)).toBe("E_UNKNOWN");
    expect(toErrorCode({})).toBe("E_UNKNOWN");
  });

  it("does not treat Object prototype keys as codes", () => {
    expect(isErrorCode("toString")).toBe(false);
    expect(toErrorCode("constructor")).toBe("E_UNKNOWN");
  });
});

describe("ActionResult helpers", () => {
  it("ok wraps data", () => {
    expect(ok({ id: "1" })).toEqual({ ok: true, data: { id: "1" } });
  });

  it("fail carries code, mapped message and field errors", () => {
    expect(fail("E_SLUG_TAKEN", { slug: "taken" })).toEqual({
      ok: false,
      code: "E_SLUG_TAKEN",
      message: "This URL name is taken.",
      fieldErrors: { slug: "taken" },
    });
  });

  it("failFrom never leaks raw error text", () => {
    const r = failFrom({ message: "relation \"nodes\" does not exist" });
    expect(r).toEqual({
      ok: false,
      code: "E_UNKNOWN",
      message: "Something went wrong. Please try again.",
    });
  });
});
