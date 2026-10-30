import type { EventContext, NodeContext } from "@/lib/permissions";

// Fixture tree shared by the permission-style tests:
//   Event (OWNER)
//   |- S1 (HEAD1)
//   |  |- S1a (HEAD1A)
//   |  |  `- T1 (ASSIGNEE)
//   |  `- T2 (HEAD1)      a head's own task
//   `- S2 (HEAD2)
//      `- T3 (PEER)
export const U = {
  OWNER: "owner",
  HEAD1: "head1",
  HEAD1A: "head1a",
  HEAD2: "head2",
  ASSIGNEE: "assignee",
  PEER: "peer",
  ADMIN: "admin",
  OUTSIDER: "outsider",
} as const;
export type Who = keyof typeof U;
export const ALL_WHO = Object.keys(U) as Who[];

const participants = new Set<string>([U.OWNER, U.HEAD1, U.HEAD1A, U.HEAD2, U.ASSIGNEE, U.PEER]);

export const N = {
  event: { type: "event", assigneeId: U.OWNER, ancestorAssigneeIds: [] },
  s1: { type: "segment", assigneeId: U.HEAD1, ancestorAssigneeIds: [U.OWNER] },
  s1a: { type: "segment", assigneeId: U.HEAD1A, ancestorAssigneeIds: [U.OWNER, U.HEAD1] },
  t1: { type: "task", assigneeId: U.ASSIGNEE, ancestorAssigneeIds: [U.OWNER, U.HEAD1, U.HEAD1A] },
  t2: { type: "task", assigneeId: U.HEAD1, ancestorAssigneeIds: [U.OWNER, U.HEAD1] },
  s2: { type: "segment", assigneeId: U.HEAD2, ancestorAssigneeIds: [U.OWNER] },
  t3: { type: "task", assigneeId: U.PEER, ancestorAssigneeIds: [U.OWNER, U.HEAD2] },
} satisfies Record<string, NodeContext>;

export function ctx(who: Who, over: Partial<EventContext> = {}): EventContext {
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
