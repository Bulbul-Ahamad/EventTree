// @vitest-environment node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { admin, cleanup, createPersona, trackOrg, uniqueSlug, type Persona } from "./helpers/harness";
import { ANON_KEY, SUPABASE_URL } from "./helpers/env";

// Plan 4.16. Attacks on the `avatars` bucket and on phone numbers through the Storage API and
// PostgREST directly, around the app. Everything must be refused, come back empty, or leave the
// victim's data unchanged. Results are summarised in tests/RLS_ADVERSARIAL.md.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const BUCKET = "avatars";

let alice: Persona; // the victim, in an organization with carol
let bob: Persona; // the attacker, in another organization
let carol: Persona; // alice's colleague
let anon: SupabaseClient;
const adm = admin as unknown as SupabaseClient;
const asBob = () => bob.client as unknown as SupabaseClient;
const asCarol = () => carol.client as unknown as SupabaseClient;
const objectExists = async (userId: string, name = "avatar") =>
  ((await adm.storage.from(BUCKET).list(userId)).data ?? []).some((o) => o.name === name);

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([createPersona("av-alice"), createPersona("av-bob"), createPersona("av-carol")]);
  anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const orgA = await adm.from("organizations").insert({ name: "Av Org A", slug: uniqueSlug("avA"), created_by: alice.id }).select("id").single();
  const orgB = await adm.from("organizations").insert({ name: "Av Org B", slug: uniqueSlug("avB"), created_by: bob.id }).select("id").single();
  if (orgA.error || orgB.error) throw new Error("setup organizations failed");
  trackOrg(orgA.data.id);
  trackOrg(orgB.data.id);
  await adm.from("org_members").insert([
    { org_id: orgA.data.id, user_id: alice.id, role: "admin" },
    { org_id: orgA.data.id, user_id: carol.id, role: "member" },
    { org_id: orgB.data.id, user_id: bob.id, role: "admin" },
  ]);

  // The victim's picture and phone number, set up by the service role.
  const up = await adm.storage.from(BUCKET).upload(`${alice.id}/avatar`, PNG, { contentType: "image/png", upsert: true });
  if (up.error) throw new Error(`setup upload: ${up.error.message}`);
  await adm.from("profiles").update({ avatar_url: `${alice.id}/avatar?v=1`, phone: "+8801711111111" }).eq("id", alice.id);
});

afterAll(async () => {
  await adm.storage.from(BUCKET).remove([alice, bob, carol].map((p) => `${p.id}/avatar`));
  await cleanup();
});

describe("avatars bucket through the Storage API", () => {
  it("anon (no login) cannot list, read, sign or write", async () => {
    expect((await anon.storage.from(BUCKET).list(alice.id)).data ?? []).toEqual([]);
    expect((await anon.storage.from(BUCKET).download(`${alice.id}/avatar`)).error).not.toBeNull();
    expect((await anon.storage.from(BUCKET).createSignedUrl(`${alice.id}/avatar`, 60)).error).not.toBeNull();
    expect((await anon.storage.from(BUCKET).upload(`${alice.id}/avatar`, PNG, { contentType: "image/png", upsert: true })).error).not.toBeNull();
  });

  it("the bucket is private: no public URL serves the picture", async () => {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${alice.id}/avatar`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("another user cannot overwrite, replace or delete the victim's picture", async () => {
    const overwrite = await asBob().storage.from(BUCKET).upload(`${alice.id}/avatar`, Buffer.from("pwned"), {
      contentType: "image/png",
      upsert: true,
    });
    expect(overwrite.error).not.toBeNull();
    const removed = await asBob().storage.from(BUCKET).remove([`${alice.id}/avatar`]);
    expect(removed.data ?? []).toEqual([]); // nothing matched for bob
    expect(await objectExists(alice.id)).toBe(true);
    const bytes = await adm.storage.from(BUCKET).download(`${alice.id}/avatar`);
    expect(Buffer.from(await bytes.data!.arrayBuffer()).equals(PNG)).toBe(true); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- download just succeeded (service role)
  });

  it("cannot write into the victim's folder under any name, nor traverse into it", async () => {
    for (const name of [`${alice.id}/other.png`, `${bob.id}/../${alice.id}/avatar`, `../${alice.id}/avatar`]) {
      const r = await asBob().storage.from(BUCKET).upload(name, PNG, { contentType: "image/png", upsert: true });
      expect(r.error, name).not.toBeNull();
    }
    expect((await adm.storage.from(BUCKET).list(alice.id)).data?.map((o) => o.name)).toEqual(["avatar"]);
  });

  it("a user can store only the one object {uid}/avatar, not other names in their own folder", async () => {
    const extra = await asBob().storage.from(BUCKET).upload(`${bob.id}/second-file.png`, PNG, { contentType: "image/png" });
    expect(extra.error).not.toBeNull();
    expect(await objectExists(bob.id, "second-file.png")).toBe(false);
  });

  it("the bucket refuses types that are not JPEG, PNG or WebP, and files over 10 MB", async () => {
    const html = await asBob().storage.from(BUCKET).upload(`${bob.id}/avatar`, Buffer.from("<script>1</script>"), {
      contentType: "text/html",
      upsert: true,
    });
    expect(html.error).not.toBeNull();
    const svg = await asBob().storage.from(BUCKET).upload(`${bob.id}/avatar`, Buffer.from("<svg/>"), {
      contentType: "image/svg+xml",
      upsert: true,
    });
    expect(svg.error).not.toBeNull();
    const big = await asBob().storage.from(BUCKET).upload(`${bob.id}/avatar`, Buffer.alloc(10 * 1024 * 1024 + 1), {
      contentType: "image/png",
      upsert: true,
    });
    expect(big.error).not.toBeNull();
    expect(await objectExists(bob.id)).toBe(false);
  });

  it("a signed URL works while the picture exists and stops working when it is removed", async () => {
    const signed = await carol.client.storage.from(BUCKET).createSignedUrl(`${alice.id}/avatar`, 60);
    expect(signed.data?.signedUrl).toBeTruthy();
    const ok = await fetch(signed.data?.signedUrl ?? "");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toContain("image/png");

    // A temporary picture of carol's own, removed again: its old link must not keep working.
    await carol.client.storage.from(BUCKET).upload(`${carol.id}/avatar`, PNG, { contentType: "image/png", upsert: true });
    const link = await carol.client.storage.from(BUCKET).createSignedUrl(`${carol.id}/avatar`, 60);
    expect((await fetch(link.data?.signedUrl ?? "")).status).toBe(200);
    await carol.client.storage.from(BUCKET).remove([`${carol.id}/avatar`]);
    expect((await fetch(link.data?.signedUrl ?? "")).status).toBeGreaterThanOrEqual(400);
  });
});

describe("avatar_url and phone through PostgREST", () => {
  it("a user cannot point their avatar_url at somebody else's picture", async () => {
    const r = await asBob().from("profiles").update({ avatar_url: `${alice.id}/avatar?v=9` }).eq("id", bob.id);
    expect(r.error).not.toBeNull();
    expect((await adm.from("profiles").select("avatar_url").eq("id", bob.id).single()).data?.avatar_url).toBeNull();
  });

  it("rejects an avatar_url that is not the user's own object", async () => {
    for (const value of ["https://evil.example/x.png", "../../etc/passwd", `${bob.id}/other`, `${bob.id}/avatar?v=abc`]) {
      const r = await asBob().from("profiles").update({ avatar_url: value }).eq("id", bob.id);
      expect(r.error, value).not.toBeNull();
    }
  });

  it("a user cannot change someone else's phone or picture", async () => {
    const r = await asBob().from("profiles").update({ phone: "+8801999999999", avatar_url: null }).eq("id", alice.id).select("id");
    expect(r.data ?? []).toEqual([]);
    const row = (await adm.from("profiles").select("phone, avatar_url").eq("id", alice.id).single()).data;
    expect(row).toEqual({ phone: "+8801711111111", avatar_url: `${alice.id}/avatar?v=1` });
  });

  it("a user in another organization cannot read the victim's phone; a colleague can", async () => {
    const outsider = await asBob().from("profiles").select("id, phone").eq("id", alice.id);
    expect(outsider.data ?? []).toEqual([]);
    const colleague = await asCarol().from("profiles").select("phone").eq("id", alice.id).single();
    expect(colleague.data?.phone).toBe("+8801711111111");
  });

  it("the database refuses malformed phone numbers sent around the app", async () => {
    for (const phone of ["12345", "+88017abc45678", "+1234567890123456", "01711111111; drop table profiles", ""]) {
      const r = await asBob().from("profiles").update({ phone }).eq("id", bob.id);
      expect(r.error, phone).not.toBeNull();
    }
    expect((await adm.from("profiles").select("phone").eq("id", bob.id).single()).data?.phone).toBe("+8801700000000");
  });

  it("anon cannot read any phone number", async () => {
    const r = await anon.from("profiles").select("phone");
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
  });
});
