import type { ZodError } from "zod";
import { errorMessage, toErrorCode, type ErrorCode } from "@/lib/errors";

// docs/02_AppFlow.md §1: Server Actions return this and never throw for
// expected errors.
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ErrorCode;
      message: string;
      fieldErrors?: Record<string, string>;
    };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return fieldErrors
    ? { ok: false, code, message: errorMessage(code), fieldErrors }
    : { ok: false, code, message: errorMessage(code) };
}

// Wrap a Supabase/RPC error (or anything thrown) into a failed ActionResult.
export function failFrom(error: unknown): ActionResult<never> {
  return fail(toErrorCode(error));
}

// First Zod message per field, keyed by field name ("" path -> "form").
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function failValidation(error: ZodError): ActionResult<never> {
  return fail("E_VALIDATION", fieldErrorsFrom(error));
}
