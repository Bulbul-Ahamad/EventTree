import { describe, expect, it } from "vitest";
import {
  compareMyEvents,
  groupMyTasks,
  pickEventRole,
  WEEK_MS,
  type MyTask,
} from "@/features/dashboard/grouping";

const NOW = new Date("2026-10-31T06:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function task(id: string, over: Partial<MyTask> = {}): MyTask {
  return {
    nodeId: id,
    title: id,
    status: "todo",
    priority: "medium",
    dueAt: null,
    eventId: "e1",
    eventTitle: "Event",
    eventStatus: "active",
    orgSlug: "org",
    ...over,
  };
}

const ids = (list: MyTask[]) => list.map((t) => t.nodeId);

describe("groupMyTasks", () => {
  it("splits into overdue / due this week / later / no due date", () => {
    const g = groupMyTasks(
      [
        task("late", { dueAt: at(-1000) }),
        task("soon", { dueAt: at(2 * 24 * 3600 * 1000) }),
        task("far", { dueAt: at(30 * 24 * 3600 * 1000) }),
        task("none"),
      ],
      NOW,
    );
    expect(ids(g.overdue)).toEqual(["late"]);
    expect(ids(g.dueThisWeek)).toEqual(["soon"]);
    expect(ids(g.later)).toEqual(["far"]);
    expect(ids(g.noDueDate)).toEqual(["none"]);
  });

  it("treats exactly 7 days as this week and one second more as later", () => {
    const g = groupMyTasks([task("edge", { dueAt: at(WEEK_MS) }), task("over", { dueAt: at(WEEK_MS + 1000) })], NOW);
    expect(ids(g.dueThisWeek)).toEqual(["edge"]);
    expect(ids(g.later)).toEqual(["over"]);
  });

  it("a task due right now is not overdue yet", () => {
    expect(ids(groupMyTasks([task("now", { dueAt: at(0) })], NOW).overdue)).toEqual([]);
  });

  it("verified tasks and tasks in draft events are never overdue (BR-09)", () => {
    const g = groupMyTasks(
      [
        task("done", { status: "verified", dueAt: at(-5000) }),
        task("draft", { eventStatus: "draft", dueAt: at(-5000) }),
      ],
      NOW,
    );
    expect(g.overdue).toEqual([]);
    expect(ids(g.dueThisWeek)).toEqual(["done", "draft"]);
  });

  it("submitted tasks past due still count as overdue", () => {
    expect(ids(groupMyTasks([task("s", { status: "submitted", dueAt: at(-5000) })], NOW).overdue)).toEqual(["s"]);
  });

  it("keeps the input order inside a group and handles an empty list", () => {
    const g = groupMyTasks([task("b", { dueAt: at(-2000) }), task("a", { dueAt: at(-1000) })], NOW);
    expect(ids(g.overdue)).toEqual(["b", "a"]);
    expect(groupMyTasks([], NOW)).toEqual({ overdue: [], dueThisWeek: [], later: [], noDueDate: [] });
  });
});

describe("pickEventRole and compareMyEvents", () => {
  it("owner beats head beats assignee", () => {
    expect(pickEventRole("u", "u", true)).toBe("owner");
    expect(pickEventRole("u", "x", true)).toBe("head");
    expect(pickEventRole("u", "x", false)).toBe("assignee");
    expect(pickEventRole("u", null, false)).toBe("assignee");
  });

  it("sorts active, draft, completed, archived, then by title", () => {
    const list = [
      { status: "archived", title: "A" },
      { status: "completed", title: "B" },
      { status: "active", title: "Z" },
      { status: "draft", title: "M" },
      { status: "active", title: "C" },
    ] as const;
    expect([...list].sort(compareMyEvents).map((e) => e.title)).toEqual(["C", "Z", "M", "B", "A"]);
  });
});
