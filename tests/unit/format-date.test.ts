import { describe, expect, it } from "vitest";
import { formatDateTime, formatEventDates, localInputToIso } from "@/lib/format-date";
import { parseEventTab } from "@/features/events/tabs";

describe("formatDateTime", () => {
  it("formats in the given time zone", () => {
    expect(formatDateTime("2026-11-01T10:00:00.000Z", "UTC")).toBe("Nov 1, 2026, 10:00 AM");
    expect(formatDateTime("2026-11-01T10:00:00.000Z", "Asia/Dhaka")).toBe("Nov 1, 2026, 4:00 PM");
  });

  it("moves to the next day when the zone is ahead of UTC", () => {
    expect(formatDateTime("2026-11-01T20:00:00.000Z", "Asia/Dhaka")).toBe("Nov 2, 2026, 2:00 AM");
  });
});

describe("formatEventDates", () => {
  const a = "2026-11-01T10:00:00.000Z";
  const b = "2026-11-02T12:30:00.000Z";

  it("shows a range, a start only, an end only, or nothing", () => {
    expect(formatEventDates(a, b, "UTC")).toBe("Nov 1, 2026, 10:00 AM – Nov 2, 2026, 12:30 PM");
    expect(formatEventDates(a, null, "UTC")).toBe("Starts Nov 1, 2026, 10:00 AM");
    expect(formatEventDates(null, b, "UTC")).toBe("Ends Nov 2, 2026, 12:30 PM");
    expect(formatEventDates(null, null, "UTC")).toBeNull();
  });
});

describe("localInputToIso", () => {
  it("returns null for empty or invalid input", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("   ")).toBeNull();
    expect(localInputToIso("not a date")).toBeNull();
  });

  it("returns an ISO string with an offset that Zod accepts", () => {
    const iso = localInputToIso("2026-11-01T10:00");
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("round-trips the local wall-clock time", () => {
    const iso = localInputToIso("2026-11-01T10:00");
    const d = new Date(iso ?? "");
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 11, 1, 10, 0]);
  });
});

describe("parseEventTab", () => {
  it("accepts the three tabs and falls back to active", () => {
    expect(parseEventTab("completed")).toBe("completed");
    expect(parseEventTab("archived")).toBe("archived");
    expect(parseEventTab("active")).toBe("active");
    expect(parseEventTab("nope")).toBe("active");
    expect(parseEventTab(undefined)).toBe("active");
    expect(parseEventTab(null)).toBe("active");
    expect(parseEventTab("toString")).toBe("active");
  });
});
