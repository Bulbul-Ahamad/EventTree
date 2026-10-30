// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { actAs, admin, cleanup, createPersona, trackOrg, uniqueSlug, type Persona } from "./helpers/harness";

vi.mock("@/lib/supabase/server", async () => {
  const { current } = await import("./helpers/session");
  return {
    createServerClient: async () => {
      if (!current.client) throw new Error("actAs() was not called");
      return current.client;
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  createOrganization,
  joinOrganization,
  leaveOrganization,
  removeMember,
  rotateJoinCode,
  setMemberRole,
} from "@/features/orgs/actions";
import { getOrgBySlug, listMyOrgs, listOrgMembers } from "@/features/orgs/queries";

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let alice: Persona; // admin of org
let bob: Persona; // plain member of org
let xena: Persona; // outsider: admin of another org
let orgId: string;
let slug: string;
let xenaOrgId: string;

async function expectFail(result: Promise<{ ok: boolean } & Record<string, unknown>>, code: string) {
  const r = await result;
  expect(r.ok).toBe(false);
  expect(r.code).toBe(code);
}

beforeAll(async () => {
  [alice, bob, xena] = await Promise.all([createPersona("alice"), createPersona("bob"), createPersona("xena")]);

  actAs(alice);
  slug = uniqueSlug();
  const created = await createOrganization({ name: "Int Org", slug, kind: "club" });
  if (!created.ok) throw new Error(`create org failed: ${created.code}`);
  const { data: org } = await admin.from("organizations").select("id, join_code").eq("slug", slug).single();
  orgId = org!.id; // set up by this test run
  trackOrg(orgId);

  actAs(bob);
  const joined = await joinOrganization({ code: org!.join_code });
  if (!joined.ok) throw new Error(`join failed: ${joined.code}`);

  actAs(xena);
  const other = uniqueSlug("other");
  await createOrganization({ name: "Other Org", slug: other, kind: "organization" });
  const { data: o2 } = await admin.from("organizations").select("id").eq("slug", other).single();
  xenaOrgId = o2!.id;
  trackOrg(xenaOrgId);
});

afterAll(cleanup);

describe("queries respect membership", () => {
  it("listMyOrgs shows my orgs with my role and nothing else", async () => {
    actAs(alice);
    expect((await listMyOrgs()).map((o) => [o.slug, o.role])).toEqual([[slug, "admin"]]);
    actAs(bob);
    expect((await listMyOrgs()).map((o) => [o.slug, o.role])).toEqual([[slug, "member"]]);
    actAs(xena);
    const mine = await listMyOrgs();
    expect(mine.map((o) => o.id)).toEqual([xenaOrgId]);
  });

  it("getOrgBySlug: admin gets the join code, member does not, outsider gets null", async () => {
    actAs(alice);
    const asAdmin = await getOrgBySlug(slug);
    expect(asAdmin?.role).toBe("admin");
    expect(asAdmin?.joinCode).toMatch(/^[0-9A-F]{12}$/);

    actAs(bob);
    const asMember = await getOrgBySlug(slug);
    expect(asMember?.role).toBe("member");
    expect(asMember?.joinCode).toBeNull();

    actAs(xena);
    expect(await getOrgBySlug(slug)).toBeNull();
    expect(await getOrgBySlug("no-such-org-slug")).toBeNull();
  });

  it("listOrgMembers: members see everyone (admins first), outsiders see nobody", async () => {
    for (const who of [alice, bob]) {
      actAs(who);
      const members = await listOrgMembers(orgId);
      expect(members.map((m) => [m.userId, m.role])).toEqual([
        [alice.id, "admin"],
        [bob.id, "member"],
      ]);
      expect(members[0]).toMatchObject({ fullName: "Int alice", email: alice.email });
    }
    actAs(xena);
    expect(await listOrgMembers(orgId)).toEqual([]);
  });
});

describe("rotateJoinCode", () => {
  it("admin rotates; the old code stops working, the new one works", async () => {
    const { data: before } = await admin.from("organizations").select("join_code").eq("id", orgId).single();
    actAs(alice);
    const r = await rotateJoinCode({ orgId });
    expect(r.ok && r.data.joinCode).toMatch(/^[0-9A-F]{12}$/);
    expect(r.ok && r.data.joinCode).not.toBe(before!.join_code);

    actAs(xena);
    await expectFail(joinOrganization({ code: before!.join_code }), "E_INVALID_JOIN_CODE");
  });

  it("a plain member and an outsider cannot rotate", async () => {
    actAs(bob);
    await expectFail(rotateJoinCode({ orgId }), "E_NOT_AUTHORIZED");
    actAs(xena);
    await expectFail(rotateJoinCode({ orgId }), "E_NOT_AUTHORIZED");
  });

  it("rejects a malformed id before touching the database", async () => {
    actAs(alice);
    await expectFail(rotateJoinCode({ orgId: "nope" }), "E_VALIDATION");
    await expectFail(rotateJoinCode({ orgId, extra: 1 }), "E_VALIDATION");
  });
});

describe("setMemberRole", () => {
  it("a member cannot change roles; an outsider cannot either", async () => {
    actAs(bob);
    await expectFail(setMemberRole({ orgId, userId: bob.id, role: "admin" }), "E_NOT_AUTHORIZED");
    actAs(xena);
    await expectFail(setMemberRole({ orgId, userId: bob.id, role: "admin" }), "E_NOT_AUTHORIZED");
  });

  it("the last admin cannot demote themselves (E_LAST_ADMIN)", async () => {
    actAs(alice);
    await expectFail(setMemberRole({ orgId, userId: alice.id, role: "member" }), "E_LAST_ADMIN");
  });

  it("admin promotes a member, who can then manage; then roles can be handed over", async () => {
    actAs(alice);
    expect((await setMemberRole({ orgId, userId: bob.id, role: "admin" })).ok).toBe(true);

    actAs(bob);
    expect((await getOrgBySlug(slug))?.role).toBe("admin");
    expect((await setMemberRole({ orgId, userId: alice.id, role: "member" })).ok).toBe(true);

    // restore: bob is admin, alice member -> alice cannot act as admin now
    actAs(alice);
    await expectFail(rotateJoinCode({ orgId }), "E_NOT_AUTHORIZED");
    actAs(bob);
    expect((await setMemberRole({ orgId, userId: alice.id, role: "admin" })).ok).toBe(true);
    expect((await setMemberRole({ orgId, userId: bob.id, role: "member" })).ok).toBe(true);
  });

  it("an unknown target is E_NOT_FOUND", async () => {
    actAs(alice);
    await expectFail(
      setMemberRole({ orgId, userId: "11111111-1111-1111-1111-111111111111", role: "member" }),
      "E_NOT_FOUND",
    );
  });
});

describe("removeMember and leaveOrganization", () => {
  it("a member cannot remove another member; an outsider cannot remove anyone", async () => {
    actAs(bob);
    await expectFail(removeMember({ orgId, userId: alice.id }), "E_NOT_AUTHORIZED");
    actAs(xena);
    await expectFail(removeMember({ orgId, userId: bob.id }), "E_NOT_AUTHORIZED");
  });

  it("the last admin cannot leave or be removed (E_LAST_ADMIN)", async () => {
    actAs(alice);
    await expectFail(leaveOrganization({ orgId }), "E_LAST_ADMIN");
    await expectFail(removeMember({ orgId, userId: alice.id }), "E_LAST_ADMIN");
  });

  it("an admin who owns an event cannot leave (E_OWNS_EVENTS) once another admin exists", async () => {
    actAs(alice);
    await setMemberRole({ orgId, userId: bob.id, role: "admin" });
    const ev = await alice.client.rpc("create_event", {
      p_org: orgId,
      p_title: "Int Event",
      p_description: "",
      p_starts_at: new Date().toISOString(),
      p_ends_at: new Date(Date.now() + 3600_000).toISOString(),
      p_location: "",
      p_review_mode: "assignee_submits",
    });
    expect(ev.error).toBeNull();
    await expectFail(leaveOrganization({ orgId }), "E_OWNS_EVENTS");
    await expectFail(removeMember({ orgId, userId: alice.id }), "E_OWNS_EVENTS");
    await setMemberRole({ orgId, userId: bob.id, role: "member" });
  });

  it("a member can leave and then no longer sees the org", async () => {
    actAs(bob);
    expect((await leaveOrganization({ orgId })).ok).toBe(true);
    expect(await getOrgBySlug(slug)).toBeNull();
    expect(await listMyOrgs()).toEqual([]);
  });

  it("an admin can remove a member (and the member can rejoin with the current code)", async () => {
    const { data: org } = await admin.from("organizations").select("join_code").eq("id", orgId).single();
    actAs(bob);
    expect((await joinOrganization({ code: org!.join_code })).ok).toBe(true);

    actAs(alice);
    expect((await removeMember({ orgId, userId: bob.id })).ok).toBe(true);
    expect((await listOrgMembers(orgId)).map((m) => m.userId)).toEqual([alice.id]);
  });
});
