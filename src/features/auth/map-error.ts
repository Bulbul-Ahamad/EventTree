import { toErrorCode, type ErrorCode } from "@/lib/errors";

type AuthErrorLike = { code?: string | undefined; status?: number | undefined; name?: string | undefined; message?: string | undefined };

// Maps a Supabase Auth error to the catalogue. Wording never reveals whether
// an account exists (TRD §8.10): unknown email and wrong password are the same.
export function mapAuthError(error: AuthErrorLike | null | undefined): ErrorCode {
  if (!error) return "E_UNKNOWN";
  switch (error.code) {
    case "invalid_credentials":
    case "user_not_found":
      return "E_INVALID_CREDENTIALS";
    case "email_not_confirmed":
      return "E_EMAIL_NOT_CONFIRMED";
    case "user_already_exists":
    case "email_exists":
      return "E_EMAIL_TAKEN";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
      return "E_RATE_LIMIT";
    case "weak_password":
    case "same_password":
    case "validation_failed":
      return "E_VALIDATION";
    case "session_not_found":
    case "not_authenticated":
      return "E_NOT_AUTHORIZED";
  }
  if (error.status === 429) return "E_RATE_LIMIT";
  if (error.name === "AuthRetryableFetchError" || error.status === 0) return "E_NETWORK";
  return toErrorCode(undefined);
}
