/**
 * Plan 4.10: one big event (exactly 1000 nodes: the event, 24 segments in two levels, 975 tasks)
 * for performance checks. Safe to run twice: if the organization exists nothing is changed.
 * Local Supabase only. Needs SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";

try {
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(".env.local");
} catch {
  // .env.local is optional if the variables are already set.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
function fail(message: string): never {
  console.error(`perf seed: ${message}`);
  process.exit(1);
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) fail(`refusing ${url || "(no URL)"}: local Supabase only.`);
if (!serviceKey) fail("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local.");

export const PERF_PASSWORD = "Passw0rd!perf";
const SLUG = "perf-club";
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error || r.data === null || r.data === undefined) fail(`${what}: ${r.error?.message ?? "no data"}`);
  return r.data as NonNullable<T>;
}

async function user(email: string, name: string): Promise<string> {
  const created = await db.auth.admin.createUser({ email, password: PERF_PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
  if (created.data.user) return created.data.user.id;
  const list = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = list.data?.users.find((u) => u.email === email);
  if (!found) fail(`user ${email}: ${created.error?.message}`);
  return found.id;
}

async function main() {
  const have = await db.from("organizations").select("id").eq("slug", SLUG).maybeSingle();
  if (have.data) {
    console.log("perf seed: already present, nothing changed.");
  } else {
    const owner = await user("perf-owner@demo.test", "Perf Owner");
    const people = await Promise.all([1, 2, 3, 4, 5].map((i) => user(`perf-m${i}@demo.test`, `Perf Member ${i}`)));
    const org = must(await db.from("organizations").insert({ name: "Perf Club", slug: SLUG, kind: "club", created_by: owner }).select("id").single(), "org");
    must(
      await db.from("org_members").insert([{ org_id: org.id, user_id: owner, role: "admin" }, ...people.map((p) => ({ org_id: org.id, user_id: p, role: "member" as const }))]).select(),
      "members",
    );
    const event = must(
      await db.from("nodes").insert({ org_id: org.id, type: "event", title: "Perf Event (1000 nodes)", assignee_id: owner, created_by: owner }).select("id").single(),
      "event",
    );
    must(await db.from("event_settings").insert({ event_id: event.id, review_mode: "assignee_submits", event_status: "draft" }).select(), "settings");

    // 12 top segments, each with 1 sub-segment = 24 segments.
    const tops = must(
      await db.from("nodes").insert(Array.from({ length: 12 }, (_, i) => ({ parent_id: event.id, type: "segment" as const, title: `Segment ${i + 1}`, assignee_id: people[i % 5], created_by: owner, position: i }))).select("id"),
      "top segments",
    );
    const subs = must(
      await db.from("nodes").insert(tops.map((t, i) => ({ parent_id: t.id, type: "segment" as const, title: `Sub-segment ${i + 1}`, assignee_id: people[(i + 1) % 5], created_by: owner }))).select("id"),
      "sub segments",
    );
    const parents = [...tops.map((t) => t.id), ...subs.map((s) => s.id)]; // 24
    const tasks = Array.from({ length: 975 }, (_, i) => ({
      parent_id: parents[i % parents.length] as string,
      type: "task" as const,
      title: `Task ${i + 1}`,
      assignee_id: people[i % 5],
      created_by: owner,
      weight: (i % 3) + 1,
      due_at: new Date(Date.now() + ((i % 40) - 10) * 86400000).toISOString(),
      position: i,
    }));
    const ids: string[] = [];
    for (let i = 0; i < tasks.length; i += 250) {
      const rows = must(await db.from("nodes").insert(tasks.slice(i, i + 250)).select("id"), `tasks ${i}`);
      ids.push(...rows.map((r) => r.id));
    }
    must(await db.from("event_settings").update({ event_status: "active" }).eq("event_id", event.id).select(), "activate");
    // About a third verified, so progress is not all zero.
    const verified = ids.filter((_, i) => i % 3 === 0);
    for (let i = 0; i < verified.length; i += 100) {
      must(
        await db.from("nodes").update({ status: "verified", submitted_at: new Date().toISOString(), verified_at: new Date().toISOString(), verified_by: owner }).in("id", verified.slice(i, i + 100)).select("id"),
        `verify ${i}`,
      );
    }
    const count = await db.from("nodes").select("id", { count: "exact", head: true }).eq("event_id", event.id);
    console.log(`perf seed: created ${count.count} nodes in the event.`);
  }
  const ev = must(await db.from("nodes").select("id").eq("type", "event").eq("title", "Perf Event (1000 nodes)").limit(1).single(), "find event");
  console.log(`\nEvent page: http://localhost:3000/o/${SLUG}/events/${ev.id}`);
  console.log(`Log in as perf-owner@demo.test / ${PERF_PASSWORD}`);
}

void main();
