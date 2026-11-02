// Phone numbers (US-18, 02_AppFlow S02/S17/S19). The app stores one normalized form:
// "+" and 8 to 15 digits. Bangladeshi numbers typed as 01XXXXXXXXX or 8801XXXXXXXXX
// become +8801XXXXXXXXX. The database CHECK (`^\+?[0-9]{8,15}$`) is the backstop.

export const PHONE_MESSAGE = "Enter a valid phone number, like 01712345678 or +8801712345678.";

export function normalizePhone(raw: string): string {
  let v = raw.trim().replace(/[\s\-().]/g, "");
  if (v.startsWith("00")) v = `+${v.slice(2)}`;
  if (/^01\d{9}$/.test(v)) return `+88${v}`;
  if (/^8801\d{9}$/.test(v)) return `+${v}`;
  return v;
}

export function isValidPhone(normalized: string): boolean {
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return false;
  // A +880 number must be a full Bangladeshi mobile number.
  if (normalized.startsWith("+880")) return /^\+8801\d{9}$/.test(normalized);
  return true;
}
