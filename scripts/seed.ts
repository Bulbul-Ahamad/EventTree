/**
 * Local demo data. Safe to run repeatedly: if the demo org already exists nothing is changed.
 * Refuses to run against anything but a local Supabase.
 * Needs SUPABASE_SERVICE_ROLE_KEY (from `pnpm db:start` output) in .env.local.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.(".env.local");
} catch {
  // .env.local is optional if the variables are already set.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function fail(message: string): never {
  console.error(`seed: ${message}`);
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
if (host !== "127.0.0.1" && host !== "localhost") {
  fail(`refusing to seed "${url || "(no URL)"}". Only a local Supabase (127.0.0.1 / localhost) is allowed.`);
}
if (!serviceKey) {
  fail("SUPABASE_SERVICE_ROLE_KEY is missing. Copy the service_role / secret key from `pnpm db:start` into .env.local.");
}

const PASSWORD = "Passw0rd!demo";
const PEOPLE = {
  owner: { email: "bulbul@demo.test", name: "Bulbul Ahmed" },
  rafi: { email: "rafi@demo.test", name: "Rafi Islam" },
  tania: { email: "tania@demo.test", name: "Tania Khan" },
  nila: { email: "nila@demo.test", name: "Nila Rahman" },
  sumon: { email: "sumon@demo.test", name: "Sumon Das" },
  outsider: { email: "imran@demo.test", name: "Imran Hossain" },
} as const;
type PersonKey = keyof typeof PEOPLE;

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    fail(`${what}: ${result.error?.message ?? "no data"}`);
  }
  return result.data as NonNullable<T>;
}

async function ensureUsers(client: SupabaseClient): Promise<Record<PersonKey, string>> {
  const existing = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (existing.error) fail(`listUsers: ${existing.error.message}`);
  const byEmail = new Map(existing.data.users.map((u) => [u.email ?? "", u.id]));
  const ids = {} as Record<PersonKey, string>;
  for (const key of Object.keys(PEOPLE) as PersonKey[]) {
    const person = PEOPLE[key];
    const found = byEmail.get(person.email);
    if (found) {
      ids[key] = found;
      continue;
    }
    const created = await client.auth.admin.createUser({
      email: person.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: person.name },
    });
    if (created.error || !created.data.user) fail(`createUser ${person.email}: ${created.error?.message}`);
    ids[key] = created.data.user.id;
  }
  return ids;
}

const day = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * day).toISOString();

async function main() {
  const ids = await ensureUsers(db);

  const slug = "duet-robotics-club";
  const have = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (have.error) fail(`organizations lookup: ${have.error.message}`);
  if (have.data) {
    process.stdout.write("seed: demo data already present, nothing changed.\n");
    return;
  }

  // Organizations
  const orgA = must(
    await db.from("organizations").insert({ name: "DUET Robotics Club", slug, kind: "club", created_by: ids.owner }).select("id").single(),
    "create org A",
  );
  const orgB = must(
    await db.from("organizations").insert({ name: "DUET Debate Society", slug: "duet-debate-society", kind: "club", created_by: ids.outsider }).select("id").single(),
    "create org B",
  );
  must(
    await db.from("org_members").insert([
      { org_id: orgA.id, user_id: ids.owner, role: "admin" },
      { org_id: orgA.id, user_id: ids.rafi, role: "member" },
      { org_id: orgA.id, user_id: ids.tania, role: "member" },
      { org_id: orgA.id, user_id: ids.nila, role: "member" },
      { org_id: orgA.id, user_id: ids.sumon, role: "member" },
      { org_id: orgB.id, user_id: ids.outsider, role: "admin" },
    ]).select(),
    "add members",
  );

  // Event root + settings (draft while we build the tree)
  const event = must(
    await db.from("nodes").insert({
      org_id: orgA.id, type: "event", title: "Tech Fest 2026",
      description: "Annual tech festival of the club.", assignee_id: ids.owner, created_by: ids.owner,
    }).select("id").single(),
    "create event",
  );
  must(
    await db.from("event_settings").insert({
      event_id: event.id, review_mode: "assignee_submits", event_status: "draft",
      starts_at: inDays(16), ends_at: inDays(17), location: "DUET Auditorium",
    }).select(),
    "create event settings",
  );

  const nodeIds = new Map<string, string>();
  async function addNode(
    key: string, parent: string, type: "segment" | "task", title: string, assignee: PersonKey | null,
    extra: { due?: number; status?: "todo" | "in_progress" | "submitted" | "verified"; weight?: number } = {},
  ) {
    const row = must(
      await db.from("nodes").insert({
        parent_id: parent, type, title, assignee_id: assignee ? ids[assignee] : null, created_by: ids.owner,
        weight: extra.weight ?? 1, due_at: extra.due === undefined ? null : inDays(extra.due),
      }).select("id").single(),
      `create ${title}`,
    );
    nodeIds.set(key, row.id);
    if (type === "task" && extra.status && extra.status !== "todo") {
      const patch: Record<string, unknown> = { status: extra.status };
      if (extra.status === "submitted") patch.submitted_at = inDays(-1);
      if (extra.status === "verified") {
        patch.submitted_at = inDays(-3);
        patch.verified_at = inDays(-2);
        patch.verified_by = ids.rafi;
      }
      must(await db.from("nodes").update(patch).eq("id", row.id).select("id").single(), `status of ${title}`);
    }
    return row.id;
  }

  const registration = await addNode("reg", event.id, "segment", "Registration", "rafi", { weight: 2 });
  await addNode("reg-form", registration, "task", "Registration form", "nila", { due: -10, status: "verified" });
  await addNode("reg-pay", registration, "task", "Payment setup", "sumon", { due: -6, status: "verified", weight: 2 });
  await addNode("reg-mail", registration, "task", "Confirmation emails", "nila", { due: -4, status: "verified" });
  await addNode("reg-remind", registration, "task", "Attendee reminders", "sumon", { due: 9, status: "in_progress" });
  await addNode("reg-wait", registration, "task", "Waitlist handling", "nila", { due: 10 });
  const desk = await addNode("desk", registration, "segment", "Check-in desk", "rafi");
  await addNode("desk-badges", desk, "task", "Print badges", "nila", { due: 12, status: "in_progress" });
  await addNode("desk-brief", desk, "task", "Volunteer briefing", "sumon", { due: 13 });
  await addNode("desk-qr", desk, "task", "QR scanner test", null, { due: 14 });

  const venue = await addNode("venue", event.id, "segment", "Venue", "tania", { weight: 2 });
  await addNode("venue-hall", venue, "task", "Hall booking confirmation", "sumon", { due: -1, status: "submitted" });
  await addNode("venue-stage", venue, "task", "Stage decoration", null, { due: 12 });
  await addNode("venue-sound", venue, "task", "Sound system", "nila", { due: 8, status: "verified" });
  await addNode("venue-light", venue, "task", "Lighting plan", "tania", { due: 7, status: "verified" });
  await addNode("venue-seat", venue, "task", "Seating layout", "sumon", { due: 11, status: "in_progress" });
  await addNode("venue-safe", venue, "task", "Safety checklist", "tania", { due: 14 });

  const publicity = await addNode("pub", event.id, "segment", "Publicity", "tania");
  await addNode("pub-poster", publicity, "task", "Poster design", "nila", { due: 2, status: "submitted" });
  await addNode("pub-social", publicity, "task", "Social media posts", "sumon", { due: -5, status: "verified" });
  await addNode("pub-banner", publicity, "task", "Print banners", "owner", { due: -2, status: "in_progress" });
  await addNode("pub-video", publicity, "task", "Teaser video", "nila", { due: 5, status: "verified" });
  await addNode("pub-press", publicity, "task", "Press release", "sumon", { due: 6 });
  await addNode("pub-logos", publicity, "task", "Sponsor logos", "sumon", { due: 4 });

  // A little activity history
  const note = (key: string, user: PersonKey, body: string) => ({ node_id: nodeIds.get(key), user_id: ids[user], kind: "comment", body });
  must(
    await db.from("node_updates").insert([
      note("pub-banner", "owner", "Quote received from the printer, waiting on final size."),
      note("venue-seat", "sumon", "Draft layout shared in the group."),
      note("desk-badges", "nila", "Template ready, printing tomorrow."),
      { node_id: nodeIds.get("pub-poster"), user_id: ids.nila, kind: "status_change", from_status: "in_progress", to_status: "submitted", body: "Final poster attached." },
      { node_id: nodeIds.get("venue-hall"), user_id: ids.sumon, kind: "status_change", from_status: "in_progress", to_status: "submitted", body: "Booking letter signed." },
    ]).select(),
    "add activity",
  );

  // Activate the event
  must(await db.from("event_settings").update({ event_status: "active" }).eq("event_id", event.id).select(), "activate event");

  process.stdout.write(
    `seed: done. ${nodeIds.size + 1} nodes in "Tech Fest 2026".\n` +
      `Log in with any of these emails, password ${PASSWORD}:\n` +
      (Object.keys(PEOPLE) as PersonKey[]).map((k) => `  ${PEOPLE[k].email}  (${k})`).join("\n") + "\n",
  );
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
