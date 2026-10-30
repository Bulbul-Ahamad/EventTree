import { describe, expect, it } from "vitest";
import {
  canComment,
  canCreateChild,
  canDeleteEvent,
  canDeleteNode,
  canEditEventSettings,
  canEditNode,
  canReassignNode,
  canSendBackOrReopen,
  canSetEventStatus,
  canSubmitTask,
  canToggleProgress,
  canVerifyTask,
  canViewEvent,
  allowedEventStatusTargets,
  type EventContext,
  type EventStatus,
  type NodeContext,
  type ReviewMode,
} from "@/lib/permissions";

// Fixture tree:
//   Event (OWNER)
//   ├─ S1 (HEAD1)
//   │  ├─ S1a (HEAD1A)
//   │  │  └─ T1 (ASSIGNEE)
//   │  └─ T2 (HEAD1)      <- a head's own task
//   └─ S2 (HEAD2)
//      └─ T3 (HEAD2PEER)
const U = { OWNER: "owner", HEAD1: "head1", HEAD1A: "head1a", HEAD2: "head2", ASSIGNEE: "assignee", PEER: "peer", ADMIN: "admin", OUTSIDER: "outsider" } as const;
type Who = keyof typeof U;
const participants = new Set<string>([U.OWNER, U.HEAD1, U.HEAD1A, U.HEAD2, U.ASSIGNEE, U.PEER]);

const N = {
  event: { type: "event", assigneeId: U.OWNER, ancestorAssigneeIds: [] },
  s1: { type: "segment", assigneeId: U.HEAD1, ancestorAssigneeIds: [U.OWNER] },
  s1a: { type: "segment", assigneeId: U.HEAD1A, ancestorAssigneeIds: [U.OWNER, U.HEAD1] },
  t1: { type: "task", assigneeId: U.ASSIGNEE, ancestorAssigneeIds: [U.OWNER, U.HEAD1, U.HEAD1A] },
  t2: { type: "task", assigneeId: U.HEAD1, ancestorAssigneeIds: [U.OWNER, U.HEAD1] },
  s2: { type: "segment", assigneeId: U.HEAD2, ancestorAssigneeIds: [U.OWNER] },
  t3: { type: "task", assigneeId: U.PEER, ancestorAssigneeIds: [U.OWNER, U.HEAD2] },
} satisfies Record<string, NodeContext>;

function ctx(who: Who, over: Partial<EventContext> = {}): EventContext {
  return {
    userId: U[who],
    ownerId: U.OWNER,
    eventStatus: "active",
    reviewMode: "assignee_submits",
    isOrgAdmin: who === "ADMIN",
    isParticipant: participants.has(U[who]),
    ...over,
  };
}

// Expect `fn` to be true exactly for the listed personas.
function only(fn: (c: EventContext) => boolean, allowed: Who[], over: Partial<EventContext> = {}) {
  const all = Object.keys(U) as Who[];
  for (const who of all) {
    expect(fn(ctx(who, over)), `${who}`).toBe(allowed.includes(who));
  }
}

describe("PRD §7 row: View event tree and history", () => {
  it("participants and org admins, not other org members", () => {
    only(canViewEvent, ["OWNER", "HEAD1", "HEAD1A", "HEAD2", "ASSIGNEE", "PEER", "ADMIN"]);
  });
});

describe("PRD §7 row: Edit event settings, lifecycle", () => {
  it("owner only", () => {
    only(canEditEventSettings, ["OWNER"]);
    only((c) => canSetEventStatus(c, "completed"), ["OWNER"]);
  });
});

describe("PRD §7 row: Create child under node N", () => {
  it("owner anywhere; head only inside the subtree they manage", () => {
    only((c) => canCreateChild(c, N.event), ["OWNER"]);
    only((c) => canCreateChild(c, N.s1), ["OWNER", "HEAD1"]);
    only((c) => canCreateChild(c, N.s1a), ["OWNER", "HEAD1", "HEAD1A"]);
    only((c) => canCreateChild(c, N.s2), ["OWNER", "HEAD2"]);
  });

  it("nobody can add under a task", () => {
    only((c) => canCreateChild(c, N.t1), []);
  });
});

describe("PRD §7 row: Edit / reassign / delete node N", () => {
  it("strict managers only (a head cannot edit their own segment)", () => {
    only((c) => canEditNode(c, N.s1), ["OWNER"]);
    only((c) => canEditNode(c, N.s1a), ["OWNER", "HEAD1"]);
    only((c) => canEditNode(c, N.t1), ["OWNER", "HEAD1", "HEAD1A"]);
    only((c) => canReassignNode(c, N.t1), ["OWNER", "HEAD1", "HEAD1A"]);
    only((c) => canDeleteNode(c, N.t3), ["OWNER", "HEAD2"]);
  });

  it("sibling segment heads cannot touch each other's subtree", () => {
    expect(canEditNode(ctx("HEAD2"), N.t1)).toBe(false);
    expect(canDeleteNode(ctx("HEAD1"), N.t3)).toBe(false);
  });

  it("the owner node: owner edits it, nobody reassigns it (BR-01)", () => {
    only((c) => canEditNode(c, N.event), ["OWNER"]);
    only((c) => canReassignNode(c, N.event), []);
  });
});

describe("PRD §7 row: todo <-> in_progress", () => {
  it("assignee on own task, strict managers above", () => {
    only((c) => canToggleProgress(c, N.t1), ["OWNER", "HEAD1", "HEAD1A", "ASSIGNEE"]);
    only((c) => canToggleProgress(c, N.t3), ["OWNER", "HEAD2", "PEER"]);
  });

  it("a head can move their own task", () => {
    only((c) => canToggleProgress(c, N.t2), ["OWNER", "HEAD1"]);
  });
});

describe("PRD §7 row: Submit, Mode A", () => {
  it("assignee of the task only; owner and heads cannot submit others' tasks", () => {
    only((c) => canSubmitTask(c, N.t1), ["ASSIGNEE"]);
  });

  it("a head who is the assignee may submit their own task (footnote *)", () => {
    only((c) => canSubmitTask(c, N.t2), ["HEAD1"]);
  });

  it("nobody can submit in Mode B", () => {
    const modeB: Partial<EventContext> = { reviewMode: "head_only" satisfies ReviewMode };
    only((c) => canSubmitTask(c, N.t1), [], modeB);
  });
});

describe("PRD §7 rows: Verify, send back, reopen, Mode B direct verify", () => {
  it("owner and strict managers who are not the assignee", () => {
    only((c) => canVerifyTask(c, N.t1), ["OWNER", "HEAD1", "HEAD1A"]);
    only((c) => canSendBackOrReopen(c, N.t1), ["OWNER", "HEAD1", "HEAD1A"]);
  });

  it("a head cannot verify their own task, but the owner can (US-11 AC2)", () => {
    only((c) => canVerifyTask(c, N.t2), ["OWNER"]);
  });

  it("the assignee never verifies", () => {
    expect(canVerifyTask(ctx("ASSIGNEE"), N.t1)).toBe(false);
    expect(canVerifyTask(ctx("PEER"), N.t3)).toBe(false);
  });

  it("Mode B uses the same verifier rule", () => {
    only((c) => canVerifyTask(c, N.t1), ["OWNER", "HEAD1", "HEAD1A"], { reviewMode: "head_only" });
  });
});

describe("PRD §7 row: Comment / proof link on N", () => {
  it("assignee on own task, managers of N", () => {
    only((c) => canComment(c, N.t1), ["OWNER", "HEAD1", "HEAD1A", "ASSIGNEE"]);
    only((c) => canComment(c, N.s1a), ["OWNER", "HEAD1", "HEAD1A"]);
    only((c) => canComment(c, N.t3), ["OWNER", "HEAD2", "PEER"]);
  });
});

describe("PRD §7 row: Delete event", () => {
  it("owner only, and only in draft or archived", () => {
    only(canDeleteEvent, [], { eventStatus: "active" });
    only(canDeleteEvent, [], { eventStatus: "completed" });
    only(canDeleteEvent, ["OWNER"], { eventStatus: "draft" });
    only(canDeleteEvent, ["OWNER"], { eventStatus: "archived" });
    only((c) => canDeleteNode(c, N.event), ["OWNER"], { eventStatus: "draft" });
  });
});

describe("BR-13: org admin is read-only", () => {
  it("can view but cannot do anything else", () => {
    const admin = ctx("ADMIN");
    expect(canViewEvent(admin)).toBe(true);
    expect(canCreateChild(admin, N.event)).toBe(false);
    expect(canEditNode(admin, N.s1)).toBe(false);
    expect(canToggleProgress(admin, N.t1)).toBe(false);
    expect(canVerifyTask(admin, N.t1)).toBe(false);
    expect(canComment(admin, N.t1)).toBe(false);
    expect(canEditEventSettings(admin)).toBe(false);
  });

  it("an admin who is also assigned gets the rights of that assignment", () => {
    const both = ctx("HEAD1", { isOrgAdmin: true });
    expect(canCreateChild(both, N.s1)).toBe(true);
  });
});

describe("BR-10: event lifecycle gates writes", () => {
  const writes = (status: EventStatus) => ({
    create: canCreateChild(ctx("OWNER", { eventStatus: status }), N.event),
    edit: canEditNode(ctx("OWNER", { eventStatus: status }), N.s1),
    comment: canComment(ctx("OWNER", { eventStatus: status }), N.t1),
    toggle: canToggleProgress(ctx("ASSIGNEE", { eventStatus: status }), N.t1),
    verify: canVerifyTask(ctx("OWNER", { eventStatus: status }), N.t1),
  });

  it("draft: structure and comments yes, status changes no", () => {
    expect(writes("draft")).toEqual({ create: true, edit: true, comment: true, toggle: false, verify: false });
  });

  it("active: everything", () => {
    expect(writes("active")).toEqual({ create: true, edit: true, comment: true, toggle: true, verify: true });
  });

  it("completed and archived: nothing", () => {
    const none = { create: false, edit: false, comment: false, toggle: false, verify: false };
    expect(writes("completed")).toEqual(none);
    expect(writes("archived")).toEqual(none);
  });
});

describe("event lifecycle transitions (02_AppFlow §6)", () => {
  const targets = (status: EventStatus, who: Who = "OWNER") => allowedEventStatusTargets(ctx(who, { eventStatus: status }));

  it("follows the table for the owner", () => {
    expect(targets("draft")).toEqual(["active"]);
    expect(targets("active")).toEqual(["completed"]);
    expect(targets("completed")).toEqual(["active", "archived"]);
    expect(targets("archived")).toEqual(["completed"]);
  });

  it("is empty for everyone else", () => {
    for (const who of ["HEAD1", "ASSIGNEE", "ADMIN", "OUTSIDER"] as Who[]) {
      expect(targets("active", who)).toEqual([]);
    }
  });

  it("rejects skipping states", () => {
    expect(canSetEventStatus(ctx("OWNER", { eventStatus: "draft" }), "completed")).toBe(false);
    expect(canSetEventStatus(ctx("OWNER", { eventStatus: "active" }), "archived")).toBe(false);
  });
});
