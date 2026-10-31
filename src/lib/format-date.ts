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

// The reverse: an ISO string -> "2026-11-01T10:00" in the browser's time zone,
// the value format of <input type="datetime-local">. Null or invalid -> "".
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "in 2 days", "tomorrow", "3 hours ago", "just now" (02_AppFlow §1: relative text,
// the absolute date goes in a tooltip). `now` is a parameter so it can be tested.
export function formatRelative(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < MINUTE) return "just now";
  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  return rtf.format(Math.round(diff / DAY), "day");
}

// "3 days overdue", "5 hours overdue", or "Overdue" when it just passed.
export function formatOverdue(iso: string, now: Date): string {
  const late = now.getTime() - new Date(iso).getTime();
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} overdue`;
  if (late >= DAY) return plural(Math.floor(late / DAY), "day");
  if (late >= HOUR) return plural(Math.floor(late / HOUR), "hour");
  return "Overdue";
}
