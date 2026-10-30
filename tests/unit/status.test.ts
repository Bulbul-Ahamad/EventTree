import { describe, expect, it } from "vitest";
import type { EventStatus, ReviewMode, TaskStatus } from "@/lib/permissions";
import { allowedTransitions, findTransition, transitionError, type TransitionId } from "@/lib/status";
import { ALL_WHO, N, ctx, type Who } from "./helpers/tree-fixture";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "submitted", "verified"];
const MODES: ReviewMode[] = ["assignee_submits", "head_only"];

type Row = { id: TransitionId; from: TaskStatus[]; to: TaskStatus; modes: ReviewMode[]; who: Who[] };

// Hand-written from docs/02_AppFlow.md §5 (not derived from the code under test).
// Task T1: assignee ASSIGNEE; strict managers OWNER, HEAD1, HEAD1A.
const T1_ROWS: Row[] = [
  { id: "T1", from: ["todo"], to: "in_progress", modes: MODES, who: ["ASSIGNEE", "OWNER", "HEAD1", "HEAD1A"] },
  { id: "T2", from: ["in_progress"], to: "todo", modes: MODES, who: ["ASSIGNEE", "OWNER", "HEAD1", "HEAD1A"] },
  { id: "T3", from: ["in_progress"], to: "submitted", modes: ["assignee_submits"], who: ["ASSIGNEE"] },
  { id: "T4", from: ["submitted"], to: "verified", modes: MODES, who: ["OWNER", "HEAD1", "HEAD1A"] },
  { id: "T5", from: ["submitted"], to: "in_progress", modes: MODES, who: ["OWNER", "HEAD1", "HEAD1A"] },
  { id: "T6", from: ["todo", "in_progress"], to: "verified", modes: ["head_only"], who: ["OWNER", "HEAD1", "HEAD1A"] },
  { id: "T7", from: ["verified"], to: "in_progress", modes: MODES, who: ["OWNER", "HEAD1", "HEAD1A"] },
];

// Task T2: assignee HEAD1, who is also its strict manager. Self-verify rule:
// HEAD1 cannot verify it; the Owner can.
const T2_ROWS: Row[] = [
  { id: "T1", from: ["todo"], to: "in_progress", modes: MODES, who: ["HEAD1", "OWNER"] },
  { id: "T2", from: ["in_progress"], to: "todo", modes: MODES, who: ["HEAD1", "OWNER"] },
  { id: "T3", from: ["in_progress"], to: "submitted", modes: ["assignee_submits"], who: ["HEAD1"] },
  { id: "T4", from: ["submitted"], to: "verified", modes: MODES, who: ["OWNER"] },
  { id: "T5", from: ["submitted"], to: "in_progress", modes: MODES, who: ["HEAD1", "OWNER"] },
  { id: "T6", from: ["todo", "in_progress"], to: "verified", modes: ["head_only"], who: ["OWNER"] },
  { id: "T7", from: ["verified"], to: "in_progress", modes: MODES, who: ["HEAD1", "OWNER"] },
];

function expectedAllowed(rows: Row[], who: Who, mode: ReviewMode, from: TaskStatus, to: TaskStatus): boolean {
  return rows.some((r) => r.from.includes(from) && r.to === to && r.modes.includes(mode) && r.who.includes(who));
}

describe.each([
  ["task T1 (plain assignee)", N.t1, T1_ROWS],
  ["task T2 (head's own task)", N.t2, T2_ROWS],
])("transition table, %s", (_name, node, rows) => {
  it("matches 02_AppFlow §5 for every persona x mode x from x to", () => {
    for (const who of ALL_WHO) {
      for (const mode of MODES) {
        for (const from of STATUSES) {
          for (const to of STATUSES) {
            const got = findTransition(ctx(who, { reviewMode: mode }), node, from, to) !== null;
            const want = expectedAllowed(rows, who, mode, from, to);
            expect(got, `${who} ${mode} ${from}->${to}`).toBe(want);
          }
        }
      }
    }
  });
});

describe("sibling and outside users", () => {
  it("another head, a peer, the org admin and an outsider have no transitions", () => {
    for (const who of ["HEAD2", "PEER", "ADMIN", "OUTSIDER"] as Who[]) {
      for (const mode of MODES) {
        for (const from of STATUSES) {
          expect(allowedTransitions(ctx(who, { reviewMode: mode }), N.t1, from)).toEqual([]);
        }
      }
    }
  });
});

describe("event must be active", () => {
  it("offers nothing in draft, completed or archived", () => {
    for (const eventStatus of ["draft", "completed", "archived"] as EventStatus[]) {
      for (const who of ALL_WHO) {
        for (const from of STATUSES) {
          expect(allowedTransitions(ctx(who, { eventStatus }), N.t1, from)).toEqual([]);
        }
      }
    }
  });

  it("reports E_EVENT_NOT_ACTIVE first", () => {
    expect(transitionError(ctx("OWNER", { eventStatus: "draft" }), N.t1, "todo", "in_progress")).toBe("E_EVENT_NOT_ACTIVE");
  });
});

describe("only tasks have a status", () => {
  it("segments and the event offer no transitions", () => {
    expect(allowedTransitions(ctx("OWNER"), N.s1, "todo")).toEqual([]);
    expect(allowedTransitions(ctx("OWNER"), N.event, "todo")).toEqual([]);
  });
});

describe("buttons for the viewer (what the UI shows)", () => {
  const ids = (who: Who, from: TaskStatus, mode: ReviewMode = "assignee_submits", node = N.t1) =>
    allowedTransitions(ctx(who, { reviewMode: mode }), node, from).map((t) => t.id);

  it("assignee: Start, then Submit; nothing once submitted", () => {
    expect(ids("ASSIGNEE", "todo")).toEqual(["T1"]);
    expect(ids("ASSIGNEE", "in_progress")).toEqual(["T2", "T3"]);
    expect(ids("ASSIGNEE", "submitted")).toEqual([]);
    expect(ids("ASSIGNEE", "verified")).toEqual([]);
  });

  it("head in Mode A: Verify or Send back a submitted task, Reopen a verified one", () => {
    expect(ids("HEAD1A", "submitted")).toEqual(["T4", "T5"]);
    expect(ids("HEAD1A", "verified")).toEqual(["T7"]);
  });

  it("head in Mode B can verify from todo and in_progress, assignee cannot submit", () => {
    expect(ids("HEAD1A", "todo", "head_only")).toEqual(["T1", "T6"]);
    expect(ids("HEAD1A", "in_progress", "head_only")).toEqual(["T2", "T6"]);
    expect(ids("ASSIGNEE", "in_progress", "head_only")).toEqual(["T2"]);
  });

  it("labels and required comments", () => {
    const send = findTransition(ctx("HEAD1A"), N.t1, "submitted", "in_progress");
    expect(send).toMatchObject({ id: "T5", label: "Send back", commentRequired: true });
    const reopen = findTransition(ctx("OWNER"), N.t1, "verified", "in_progress");
    expect(reopen).toMatchObject({ id: "T7", label: "Reopen", commentRequired: true });
    const verify = findTransition(ctx("OWNER"), N.t1, "submitted", "verified");
    expect(verify).toMatchObject({ id: "T4", label: "Verify", commentRequired: false });
  });

  it("a submitted task still verifies after the mode is switched to B", () => {
    expect(ids("HEAD1A", "submitted", "head_only")).toEqual(["T4", "T5"]);
  });
});

describe("transitionError mirrors the database order", () => {
  const owner = ctx("OWNER");

  it("returns null for an allowed move", () => {
    expect(transitionError(owner, N.t1, "submitted", "verified")).toBeNull();
    expect(transitionError(owner, N.t1, "submitted", "in_progress", "Fix the venue name")).toBeNull();
  });

  it("E_INVALID_TRANSITION for anything not in the table", () => {
    expect(transitionError(owner, N.t1, "todo", "submitted")).toBe("E_INVALID_TRANSITION");
    expect(transitionError(owner, N.t1, "verified", "todo")).toBe("E_INVALID_TRANSITION");
    expect(transitionError(owner, N.t1, "todo", "verified")).toBe("E_INVALID_TRANSITION"); // Mode A
    expect(transitionError(ctx("ASSIGNEE"), N.t1, "submitted", "verified")).toBe("E_INVALID_TRANSITION");
  });

  it("E_COMMENT_REQUIRED for send back and reopen without a comment", () => {
    expect(transitionError(owner, N.t1, "submitted", "in_progress")).toBe("E_COMMENT_REQUIRED");
    expect(transitionError(owner, N.t1, "submitted", "in_progress", "   ")).toBe("E_COMMENT_REQUIRED");
    expect(transitionError(owner, N.t1, "verified", "in_progress", null)).toBe("E_COMMENT_REQUIRED");
  });

  it("checks permission before the comment", () => {
    expect(transitionError(ctx("ASSIGNEE"), N.t1, "submitted", "in_progress")).toBe("E_INVALID_TRANSITION");
  });
});
