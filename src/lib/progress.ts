// Progress roll-up: docs/01_PRD.md BR-06, mirrors the DB trigger
// recompute_progress_upwards (05_Schema §3.4). Used for tests and optimistic
// display; the database value (`progress_cached`) is the source of truth.

export type ProgressNode = {
  id: string;
  parent_id: string | null;
  type: "event" | "segment" | "task";
  status: "todo" | "in_progress" | "submitted" | "verified" | null;
  weight: number;
};

// Same rounding as `round(v, 2)` in Postgres for positive values.
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Task progress: 100 if verified, else 0.
export function taskProgress(status: ProgressNode["status"]): number {
  return status === "verified" ? 100 : 0;
}

// Segment/event progress: weighted average of direct children, rounded to 2
// decimals. No children gives 0 (and still counts in its parent's average).
export function weightedProgress(children: ReadonlyArray<{ progress: number; weight: number }>): number {
  let sum = 0;
  let weights = 0;
  for (const c of children) {
    sum += c.progress * c.weight;
    weights += c.weight;
  }
  return weights === 0 ? 0 : round2(sum / weights);
}

// Progress of every node in a flat list, computed bottom-up. Like the DB,
// each level rounds before its parent uses the value.
export function computeProgress(nodes: readonly ProgressNode[]): Map<string, number> {
  const childrenOf = new Map<string, ProgressNode[]>();
  for (const n of nodes) {
    if (n.parent_id === null) continue;
    const list = childrenOf.get(n.parent_id);
    if (list) list.push(n);
    else childrenOf.set(n.parent_id, [n]);
  }

  const result = new Map<string, number>();
  const visit = (n: ProgressNode): number => {
    const cached = result.get(n.id);
    if (cached !== undefined) return cached;
    const value =
      n.type === "task"
        ? taskProgress(n.status)
        : weightedProgress((childrenOf.get(n.id) ?? []).map((c) => ({ progress: visit(c), weight: c.weight })));
    result.set(n.id, value);
    return value;
  };
  for (const n of nodes) visit(n);
  return result;
}
