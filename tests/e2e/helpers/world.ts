import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { ANON_KEY, SERVICE_ROLE_KEY, SUPABASE_URL } from "./env";

export const PASSWORD = "Passw0rd!e2etest";

// Service-role client: set-up and clean-up only. Behaviour is always driven through the UI.
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Segment = { title: string; head: Person; tasks: { title: string; assignee: Person; status?: "submitted" }[] };

export type Person = { key: string; id: string; email: string; name: string };

// Each spec file builds its own users and organization with unique names and removes
// them afterwards, so specs never see each other's data (fresh state without a slow
// `supabase db reset` between files).
export class World {
  readonly runId = randomBytes(4).toString("hex");
  readonly people: Record<string, Person> = {};
  private orgIds: string[] = [];

  // Everybody gets a phone number (US-18), otherwise the app sends them to /complete-profile.
  // Pass `null` to create a person without one.
  async person(key: string, displayName?: string, phone: string | null = "+8801700000000"): Promise<Person> {
    const email = `e2e-${this.runId}-${key}@test.local`;
    const name = displayName ?? `E2E ${key}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: phone === null ? { full_name: name } : { full_name: name, phone },
    });
    if (error || !data.user) throw new Error(`createUser ${key}: ${error?.message}`);
    const person = { key, id: data.user.id, email, name };
    this.people[key] = person;
    return person;
  }

  // The person created under this key (fails loudly instead of returning undefined).
  who(key: string): Person {
    const person = this.people[key];
    if (!person) throw new Error(`no person "${key}" in this world`);
    return person;
  }

  // Organization with the given members (first one is the admin).
  async org(name: string, members: Person[]): Promise<{ id: string; slug: string; name: string }> {
    const admin0 = members[0];
    if (!admin0) throw new Error("an organization needs at least one member");
    const slug = `e2e-${this.runId}-${randomBytes(2).toString("hex")}`;
    const created = await admin
      .from("organizations")
      .insert({ name, slug, kind: "club", created_by: admin0.id })
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
    segment: Segment;
    more?: Segment[]; // further segments directly under the event
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
    for (const sg of [segment, ...(args.more ?? [])]) {
      const seg = await admin
        .from("nodes")
        .insert({ parent_id: event.data.id, type: "segment", title: sg.title, assignee_id: sg.head.id, created_by: owner.id })
        .select("id")
        .single();
      if (seg.error) throw new Error(`create segment: ${seg.error.message}`);
      for (const t of sg.tasks) {
        const task = await admin
          .from("nodes")
          .insert({ parent_id: seg.data.id, type: "task", title: t.title, assignee_id: t.assignee.id, created_by: owner.id })
          .select("id")
          .single();
        if (task.error) throw new Error(`create task: ${task.error.message}`);
        if (t.status === "submitted") {
          const moved = await admin
            .from("nodes")
            .update({ status: "submitted", submitted_at: new Date().toISOString() })
            .eq("id", task.data.id);
          if (moved.error) throw new Error(`submit task: ${moved.error.message}`);
        }
      }
    }
    const active = await admin.from("event_settings").update({ event_status: "active" }).eq("event_id", event.data.id);
    if (active.error) throw new Error(`activate: ${active.error.message}`);
    return event.data.id;
  }

  // Titles must be unique per run (put runId in them).
  async nodeId(title: string): Promise<string> {
    const row = await admin.from("nodes").select("id").eq("title", title).single();
    if (row.error) throw new Error(`find ${title}: ${row.error.message}`);
    return row.data.id;
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

// A client that acts as this person with the public key, so RLS applies like in the app.
// Used to call the API directly, around the UI.
export async function apiAs(person: Person): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: PASSWORD });
  if (error) throw new Error(`api sign in ${person.email}: ${error.message}`);
  return client;
}
