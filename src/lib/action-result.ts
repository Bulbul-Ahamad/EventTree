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
