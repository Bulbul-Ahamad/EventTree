import "server-only";
import { cookies } from "next/headers";
import { listMyOrgs, type MyOrg } from "@/features/orgs/queries";
import { AVATAR_BUCKET, storagePathOf } from "@/lib/avatar";
import { createServerClient } from "@/lib/supabase/server";
import { LAST_ORG_COOKIE, pickOrgSlug } from "./nav-items";

export type ShellData = {
  user: { id: string; name: string; email: string };
  orgs: MyOrg[];
  // The organization the page is in (from the URL), or null on org-less pages.
  currentOrg: MyOrg | null;
  // The organization the nav links point to.
  navOrg: MyOrg | null;
  // Signed picture URLs (valid one hour) for every person the viewer can see, by user id.
  avatarUrls: Record<string, string>;
};

const AVATAR_URL_SECONDS = 3600;

// RLS limits profiles to me and the people I share an organization with. One query and one
// batch signing call; a failure just means initials are shown.
async function loadAvatarUrls(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<Record<string, string>> {
  const { data } = await supabase.from("profiles").select("id, avatar_url").not("avatar_url", "is", null);
  const rows = (data ?? []).flatMap((r) => (r.avatar_url ? [{ id: r.id, path: storagePathOf(r.avatar_url) }] : []));
  if (rows.length === 0) return {};
  const { data: signed } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(rows.map((r) => r.path), AVATAR_URL_SECONDS);
  const byPath = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const urls: Record<string, string> = {};
  for (const r of rows) {
    const url = byPath.get(r.path);
    if (url) urls[r.id] = url;
  }
  return urls;
}

// Everything the app shell needs, read once per layout render. RLS limits the
// organizations to the ones I belong to. Returns null for guests.
export async function loadShellData(currentSlug: string | null): Promise<ShellData | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, orgs, jar, avatarUrls] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    listMyOrgs(),
    cookies(),
    loadAvatarUrls(supabase),
  ]);

  const currentOrg = currentSlug ? (orgs.find((o) => o.slug === currentSlug) ?? null) : null;
  const navSlug = currentOrg ? currentOrg.slug : pickOrgSlug(orgs.map((o) => o.slug), jar.get(LAST_ORG_COOKIE)?.value);
  return {
    user: { id: user.id, name: profile?.full_name ?? user.email ?? "Account", email: profile?.email ?? user.email ?? "" },
    orgs,
    currentOrg,
    navOrg: orgs.find((o) => o.slug === navSlug) ?? null,
    avatarUrls,
  };
}
