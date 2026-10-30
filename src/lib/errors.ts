// Error catalogue: docs/02_AppFlow.md §7. DB/RPC errors are raised as
// `raise exception 'E_CODE'`; Server Actions map `error.message` through here.

export const ERROR_MESSAGES = {
  E_NOT_AUTHORIZED: "You don't have permission to do that.",
  E_NOT_FOUND: "That item no longer exists.",
  E_INVALID_TRANSITION: "That action isn't available for this task right now.",
  E_STALE_STATE: "This task was just updated by someone else. We've refreshed it.",
  E_COMMENT_REQUIRED: "Please add a comment explaining why.",
  E_EVENT_NOT_ACTIVE: "Task updates are only available while the event is active.",
  E_EVENT_READONLY: "This event is read-only.",
  E_ASSIGNEE_NOT_IN_ORG: "You can only assign people from this organization.",
  E_INVALID_JOIN_CODE: "Invalid or expired code.",
  E_SLUG_TAKEN: "This URL name is taken.",
  E_LAST_ADMIN: "An organization must keep at least one admin.",
  E_OWNS_EVENTS: "This member owns events. Resolve those first.",
  E_MAX_DEPTH: "Maximum nesting depth reached.",
  E_PARENT_IS_TASK: "Tasks can't contain other items.",
  E_NODE_LIMIT: "This event reached the 1000-item limit.",
  E_ROOT_IMMUTABLE: "The event owner can't be changed.",
  E_EMAIL_TAKEN: "An account with this email may already exist. Try logging in.",
  // The catalogue says "field-level messages from Zod"; this is the fallback
  // shown when no field message is available.
  E_VALIDATION: "Please check the highlighted fields.",
  E_RATE_LIMIT: "Too many attempts. Try again in a few minutes.",
  E_NETWORK: "Can't reach the server. Check your connection and retry.",
  E_UNKNOWN: "Something went wrong. Please try again.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export const ERROR_CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.hasOwn(ERROR_MESSAGES, value);
}

export function errorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}

// Maps a raw error message (e.g. PostgREST `error.message`) to an ErrorCode.
// Anything that is not an exact catalogue code becomes E_UNKNOWN, so raw SQL
// text or stack traces never reach the user.
export function toErrorCode(raw: unknown): ErrorCode {
  const text =
    typeof raw === "string"
      ? raw
      : raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string"
        ? raw.message
        : "";
  const code = text.trim();
  return isErrorCode(code) ? code : "E_UNKNOWN";
}
