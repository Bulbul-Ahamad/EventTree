"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import type { ErrorCode } from "@/lib/errors";
import { notify } from "@/lib/toast";

type FieldErrors = Record<string, string>;
const TOAST_CODES: ErrorCode[] = ["E_RATE_LIMIT", "E_NETWORK", "E_UNKNOWN"];

// Shared state for the auth forms: pending flag, field errors and a form-level
// message. Recoverable errors show inline; rate-limit/network/unknown also toast.
export function useFormAction() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  function reset() {
    setFieldErrors({});
    setFormError(null);
    setErrorCode(null);
  }

  function setFailure(result: Extract<ActionResult<unknown>, { ok: false }>) {
    setErrorCode(result.code);
    setFieldErrors(result.fieldErrors ?? {});
    // Field messages are enough for validation errors; otherwise show the form message.
    setFormError(result.code === "E_VALIDATION" && result.fieldErrors ? null : result.message);
    if (TOAST_CODES.includes(result.code)) notify.error(result.message);
  }

  function run<T>(task: () => Promise<ActionResult<T>>, onOk: (data: T) => void) {
    reset();
    startTransition(async () => {
      const result = await task();
      if (result.ok) onOk(result.data);
      else setFailure(result);
    });
  }

  return { pending, fieldErrors, setFieldErrors, formError, errorCode, reset, run };
}
