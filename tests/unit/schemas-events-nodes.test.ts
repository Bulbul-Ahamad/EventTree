import { describe, expect, it } from "vitest";
import { createEventSchema, setEventStatusSchema, updateEventSettingsSchema } from "@/features/events/schemas";
import { createNodeSchema, reassignNodeSchema, updateNodeSchema } from "@/features/nodes/schemas";

const ID = "00000000-0000-0000-0000-000000000001"; // seed-style id, not RFC v4
const ID2 = "30000000-0000-0000-0000-000000000002";
const T1 = "2026-12-12T10:00:00.000Z";
const T2 = "2026-12-13T10:00:00.000Z";

describe("createEventSchema", () => {
  const ok = { orgId: ID, title: "Tech Fest" };

  it("accepts a minimal event and defaults review mode to Mode A", () => {
    const r = createEventSchema.safeParse(ok);
    expect(r.success && r.data.reviewMode).toBe("assignee_submits");
  });

  it("title is required, 1-200 characters", () => {
    expect(createEventSchema.safeParse({ ...ok, title: "  " }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...ok, title: "a".repeat(200) }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...ok, title: "a".repeat(201) }).success).toBe(false);
  });

  it("accepts Bangla and emoji text", () => {
    expect(createEventSchema.safeParse({ ...ok, title: "প্রযুক্তি মেলা 🎉" }).success).toBe(true);
  });

  it("description <= 5000 and location <= 200; empty becomes null", () => {
    expect(createEventSchema.safeParse({ ...ok, description: "a".repeat(5001) }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...ok, location: "a".repeat(201) }).success).toBe(false);
    const r = createEventSchema.safeParse({ ...ok, location: "   " });
    expect(r.success && r.data.location).toBeNull();
  });

  it("end must not be before start, error is on endsAt", () => {
    expect(createEventSchema.safeParse({ ...ok, startsAt: T1, endsAt: T1 }).success).toBe(true);
    expect(createEventSchema.safeParse({ ...ok, startsAt: T1, endsAt: T2 }).success).toBe(true);
    const r = createEventSchema.safeParse({ ...ok, startsAt: T2, endsAt: T1 });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0]?.path).toEqual(["endsAt"]);
    expect(createEventSchema.safeParse({ ...ok, startsAt: T2 }).success).toBe(true);
  });

  it("rejects bad dates, unknown review modes and extra keys", () => {
    expect(createEventSchema.safeParse({ ...ok, startsAt: "tomorrow" }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...ok, startsAt: "2026-12-12T10:00" }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...ok, reviewMode: "anyone" }).success).toBe(false);
    expect(createEventSchema.safeParse({ ...ok, status: "active" }).success).toBe(false);
  });

  it("rejects ids that are not uuid-shaped", () => {
    expect(createEventSchema.safeParse({ ...ok, orgId: "123" }).success).toBe(false);
  });
});

describe("event settings and lifecycle", () => {
  it("settings use the same rules plus an event id", () => {
    expect(updateEventSettingsSchema.safeParse({ eventId: ID, title: "New", startsAt: T2, endsAt: T1 }).success).toBe(false);
    expect(updateEventSettingsSchema.safeParse({ eventId: ID, title: "New", reviewMode: "head_only" }).success).toBe(true);
  });

  it("status must be one of the four lifecycle states", () => {
    for (const to of ["draft", "active", "completed", "archived"]) {
      expect(setEventStatusSchema.safeParse({ eventId: ID, to }).success).toBe(true);
    }
    expect(setEventStatusSchema.safeParse({ eventId: ID, to: "deleted" }).success).toBe(false);
  });
});

describe("createNodeSchema", () => {
  const ok = { parentId: ID, type: "task", title: "Book hall" };

  it("defaults priority medium and weight 1", () => {
    const r = createNodeSchema.safeParse(ok);
    expect(r.success && [r.data.priority, r.data.weight]).toEqual(["medium", 1]);
  });

  it("weight must be a whole number from 1 to 10", () => {
    for (const w of [1, 5, 10]) expect(createNodeSchema.safeParse({ ...ok, weight: w }).success).toBe(true);
    for (const w of [0, 11, -1, 2.5, Number.NaN]) {
      expect(createNodeSchema.safeParse({ ...ok, weight: w }).success).toBe(false);
    }
    expect(createNodeSchema.safeParse({ ...ok, weight: "3" }).success).toBe(false);
  });

  it("only segment or task can be created", () => {
    expect(createNodeSchema.safeParse({ ...ok, type: "segment" }).success).toBe(true);
    expect(createNodeSchema.safeParse({ ...ok, type: "event" }).success).toBe(false);
  });

  it("assignee is optional and may be null", () => {
    expect(createNodeSchema.safeParse({ ...ok, assigneeId: null }).success).toBe(true);
    expect(createNodeSchema.safeParse({ ...ok, assigneeId: ID2 }).success).toBe(true);
    expect(createNodeSchema.safeParse({ ...ok, assigneeId: "bob" }).success).toBe(false);
  });

  it("title 1-200, priority enum, extra keys rejected", () => {
    expect(createNodeSchema.safeParse({ ...ok, title: "" }).success).toBe(false);
    expect(createNodeSchema.safeParse({ ...ok, title: "a".repeat(201) }).success).toBe(false);
    expect(createNodeSchema.safeParse({ ...ok, priority: "asap" }).success).toBe(false);
    expect(createNodeSchema.safeParse({ ...ok, status: "verified" }).success).toBe(false);
    expect(createNodeSchema.safeParse({ ...ok, progress_cached: 100 }).success).toBe(false);
  });

  it("keeps HTML as plain text (no stripping or rejection)", () => {
    const r = createNodeSchema.safeParse({ ...ok, title: "<img src=x onerror=alert(1)>" });
    expect(r.success && r.data.title).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("updateNodeSchema / reassignNodeSchema", () => {
  it("needs at least one field to change", () => {
    expect(updateNodeSchema.safeParse({ nodeId: ID }).success).toBe(false);
    expect(updateNodeSchema.safeParse({ nodeId: ID, title: "Renamed" }).success).toBe(true);
    expect(updateNodeSchema.safeParse({ nodeId: ID, dueAt: null }).success).toBe(true);
    expect(updateNodeSchema.safeParse({ nodeId: ID, description: null }).success).toBe(true);
  });

  it("applies the same field rules and cannot change type, parent or status", () => {
    expect(updateNodeSchema.safeParse({ nodeId: ID, weight: 11 }).success).toBe(false);
    expect(updateNodeSchema.safeParse({ nodeId: ID, title: " " }).success).toBe(false);
    expect(updateNodeSchema.safeParse({ nodeId: ID, type: "task", title: "x" }).success).toBe(false);
    expect(updateNodeSchema.safeParse({ nodeId: ID, parentId: ID2, title: "x" }).success).toBe(false);
    expect(updateNodeSchema.safeParse({ nodeId: ID, status: "verified", title: "x" }).success).toBe(false);
  });

  it("reassign takes an id or null (unassign)", () => {
    expect(reassignNodeSchema.safeParse({ nodeId: ID, assigneeId: ID2 }).success).toBe(true);
    expect(reassignNodeSchema.safeParse({ nodeId: ID, assigneeId: null }).success).toBe(true);
    expect(reassignNodeSchema.safeParse({ nodeId: ID }).success).toBe(false);
  });
});
