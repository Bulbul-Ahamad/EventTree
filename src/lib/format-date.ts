// Date display and input helpers (02_AppFlow §1: browser timezone, Intl).
// `timeZone` is only passed by tests; in the app the browser default is used.

export function formatDateTime(iso: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat("en", options).format(new Date(iso));
}

// "Nov 1, 2026, 10:00 AM – Nov 2, 2026, 6:00 PM", "Starts …", "Ends …" or null.
export function formatEventDates(
  startsAt: string | null,
  endsAt: string | null,
  timeZone?: string,
): string | null {
  if (startsAt && endsAt) return `${formatDateTime(startsAt, timeZone)} – ${formatDateTime(endsAt, timeZone)}`;
  if (startsAt) return `Starts ${formatDateTime(startsAt, timeZone)}`;
  if (endsAt) return `Ends ${formatDateTime(endsAt, timeZone)}`;
  return null;
}

// <input type="datetime-local"> gives "2026-11-01T10:00" in the browser's time
// zone. The API wants an ISO string with an offset. Empty or invalid -> null.
export function localInputToIso(value: string): string | null {
  if (value.trim() === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
