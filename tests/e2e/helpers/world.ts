import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

export const PASSWORD = "Passw0rd!e2etest";

// Service-role client: set-up and clean-up only. Behaviour is always driven through the UI.
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Person = { key: string; id: string; email: string; name: string };

// Each spec file builds its own users and organization with unique names and removes
// them afterwards, so specs never see each other's data (fresh state without a slow
// `supabase db reset` between files).
export class World {
  readonly runId = randomBytes(4).toString("hex");
  readonly people: Record<string, Person> = {};
  private orgIds: string[] = [];

  async person(key: string, displayName?: string): Promise<Person> {
    const email = `e2e-${this.runId}-${key}@test.local`;
    const name = displayName ?? `E2E ${key}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error || !data.user) throw new Error(`createUser ${key}: ${error?.message}`);
    const person = { key, id: data.user.id, email, name };
    this.people[key] = person;
    return person;
  }

  // Organization with the given members (first one is the admin).
  async org(name: string, members: Person[]): Promise<{ id: string; slug: string; name: string }> {
    const slug = `e2e-${this.runId}-${randomBytes(2).toString("hex")}`;
    const created = await admin
      .from("organizations")
      .insert({ name, slug, kind: "club", created_by: members[0].id })
      .select("id")
      .single();
    if (created.error) throw new Error(`create org: ${created.error.message}`);
    this.orgIds.push(created.data.id);
    const rows = members.map((m, i) => ({ org_id: created.data.id, user_id: m.id, role: i === 0 ? "admin" : "member" }));
    const added = await admin.from("org_members").insert(rows);
    if (added.error) throw new Error(`add members: ${added.error.message}`);
    return { id: created.data.id, slug, name };
  }

  // An event built directly in the database (set-up only): one segment with the given
  // head and the given tasks, already active. Returns the event id for the URL.
  async activeEvent(args: {
    orgId: string;
    owner: Person;
    title: string;
    reviewMode: "assignee_submits" | "head_only";
    segment: { title: string; head: Person; tasks: { title: string; assignee: Person }[] };
  }): Promise<string> {
    const { orgId, owner, title, reviewMode, segment } = args;
    const event = await admin
      .from("nodes")
      .insert({ org_id: orgId, type: "event", title, assignee_id: owner.id, created_by: owner.id })
      .select("id")
      .single();
    if (event.error) throw new Error(`create event: ${event.error.message}`);
    const settings = await admin.from("event_settings").insert({ event_id: event.data.id, review_mode: reviewMode, event_status: "draft" });
    if (settings.error) throw new Error(`event settings: ${settings.error.message}`);
    const seg = await admin
      .from("nodes")
      .insert({ parent_id: event.data.id, type: "segment", title: segment.title, assignee_id: segment.head.id, created_by: owner.id })
      .select("id")
      .single();
    if (seg.error) throw new Error(`create segment: ${seg.error.message}`);
    for (const t of segment.tasks) {
      const task = await admin
        .from("nodes")
        .insert({ parent_id: seg.data.id, type: "task", title: t.title, assignee_id: t.assignee.id, created_by: owner.id });
      if (task.error) throw new Error(`create task: ${task.error.message}`);
    }
    const active = await admin.from("event_settings").update({ event_status: "active" }).eq("event_id", event.data.id);
    if (active.error) throw new Error(`activate: ${active.error.message}`);
    return event.data.id;
  }

  // Children first: nodes restrict organization deletes.
  async cleanup() {
    if (this.orgIds.length > 0) {
      await admin.from("nodes").delete().in("org_id", this.orgIds);
      await admin.from("organizations").delete().in("id", this.orgIds);
    }
    for (const p of Object.values(this.people)) await admin.auth.admin.deleteUser(p.id);
    this.orgIds = [];
    for (const key of Object.keys(this.people)) delete this.people[key];
  }
}
