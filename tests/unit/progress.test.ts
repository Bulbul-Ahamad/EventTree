import { describe, expect, it } from "vitest";
import { computeProgress, round2, taskProgress, weightedProgress, type ProgressNode } from "@/lib/progress";

const seg = (id: string, parent: string | null, weight = 1): ProgressNode => ({
  id,
  parent_id: parent,
  type: parent === null ? "event" : "segment",
  status: null,
  weight,
});
const task = (id: string, parent: string, status: ProgressNode["status"], weight = 1): ProgressNode => ({
  id,
  parent_id: parent,
  type: "task",
  status,
  weight,
});

describe("task and weighted progress (BR-06)", () => {
  it("a task is 100 only when verified", () => {
    expect(taskProgress("verified")).toBe(100);
    for (const s of ["todo", "in_progress", "submitted", null] as const) expect(taskProgress(s)).toBe(0);
  });

  it("weighted average of children", () => {
    expect(weightedProgress([])).toBe(0);
    expect(weightedProgress([{ progress: 100, weight: 1 }, { progress: 0, weight: 1 }])).toBe(50);
    expect(weightedProgress([{ progress: 100, weight: 1 }, { progress: 0, weight: 2 }])).toBe(33.33);
    expect(weightedProgress([{ progress: 100, weight: 9 }, { progress: 0, weight: 1 }])).toBe(90);
    expect(weightedProgress([{ progress: 100, weight: 1 }])).toBe(100);
  });

  it("rounds to 2 decimals like the database", () => {
    expect(round2(66.666666)).toBe(66.67);
    expect(round2(33.335)).toBe(33.34);
    expect(round2(0)).toBe(0);
  });
});

describe("computeProgress", () => {
  it("empty event is 0", () => {
    expect(computeProgress([seg("e", null)]).get("e")).toBe(0);
  });

  it("an empty segment is 0 but still counts in its parent's average", () => {
    const p = computeProgress([seg("e", null), seg("s1", "e"), seg("s2", "e"), task("t", "s1", "verified")]);
    expect(p.get("s1")).toBe(100);
    expect(p.get("s2")).toBe(0);
    expect(p.get("e")).toBe(50);
  });

  it("uses weights at every level", () => {
    const p = computeProgress([
      seg("e", null),
      seg("a", "e", 3),
      seg("b", "e", 1),
      task("a1", "a", "verified", 1),
      task("a2", "a", "todo", 1),
      task("b1", "b", "verified", 1),
    ]);
    expect(p.get("a")).toBe(50);
    expect(p.get("b")).toBe(100);
    expect(p.get("e")).toBe(62.5); // (50*3 + 100*1) / 4
  });

  it("rounds each level before the parent uses it (matches the trigger)", () => {
    const p = computeProgress([
      seg("e", null),
      seg("s", "e"),
      task("t1", "s", "verified", 1),
      task("t2", "s", "todo", 2),
      task("x", "e", "todo", 1),
    ]);
    expect(p.get("s")).toBe(33.33);
    expect(p.get("e")).toBe(16.67); // (33.33*1 + 0*1) / 2 = 16.665 -> 16.67
  });

  it("works for a 6-deep chain and reacts to verification", () => {
    const chain: ProgressNode[] = [seg("n0", null)];
    for (let d = 1; d <= 5; d++) chain.push(seg(`n${d}`, `n${d - 1}`));
    chain.push(task("leaf", "n5", "todo")); // depth 6
    expect(computeProgress(chain).get("n0")).toBe(0);
    const done = chain.map((n) => (n.id === "leaf" ? { ...n, status: "verified" as const } : n));
    const p = computeProgress(done);
    for (let d = 0; d <= 5; d++) expect(p.get(`n${d}`)).toBe(100);
  });

  it("submitted counts as not done", () => {
    const p = computeProgress([seg("e", null), task("t", "e", "submitted")]);
    expect(p.get("e")).toBe(0);
  });

  it("is independent of row order", () => {
    const rows = [seg("e", null), seg("s", "e"), task("t", "s", "verified")];
    expect(computeProgress([...rows].reverse()).get("e")).toBe(100);
  });
});
