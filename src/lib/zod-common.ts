import { z } from "zod";

// Shared Zod building blocks for the features/*/schemas.ts files.

// Any 8-4-4-4-12 hex id. z.uuid() would reject valid Postgres uuids that do
// not carry RFC version bits (for example the seeded 0000...0001 ids).
export const id = z.guid("Invalid id.");

// ISO 8601 date-time with an offset (what `new Date().toISOString()` gives).
export const isoDateTime = z.iso.datetime({ offset: true, message: "Enter a valid date and time." });

// Optional free text: trimmed, empty string becomes null, length capped.
export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters.`)
    .transform((v) => (v === "" ? null : v))
    .nullish();

// Required free text: trimmed, 1..max characters.
export const requiredText = (max: number, emptyMessage = "This field is required.") =>
  z.string().trim().min(1, emptyMessage).max(max, `Use at most ${max} characters.`);

// A link that starts with http:// or https:// (US-10 AC2, TRD §8.6).
export const httpUrl = z
  .string()
  .trim()
  .max(2000, "Use at most 2000 characters.")
  .regex(/^https?:\/\/\S+$/i, "Enter a link starting with http:// or https://.")
  .refine((v) => URL.canParse(v), "Enter a valid link.");

export function endNotBeforeStart(v: { startsAt?: string | null | undefined; endsAt?: string | null | undefined }) {
  if (!v.startsAt || !v.endsAt) return true;
  return new Date(v.endsAt).getTime() >= new Date(v.startsAt).getTime();
}
export const END_BEFORE_START = { path: ["endsAt"], message: "End must be on or after the start." };
