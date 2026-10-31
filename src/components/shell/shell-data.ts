import "server-only";
import { cookies } from "next/headers";
import { listMyOrgs, type MyOrg } from "@/features/orgs/queries";
import { createServerClient } from "@/lib/supabase/server";
import { LAST_ORG_COOKIE, pickOrgSlug } from "./nav-items";

export type ShellData = {
  user: { id: string; name: string; email: string };
  orgs: MyOrg[];
  // The organization the page is in (from the URL), or null on org-less pages.
  currentOrg: MyOrg | null;
  // The organization the nav links point to.
  navOrg: MyOrg | null;
};

// Everything the app shell needs, read once per layout render. RLS limits the
// organizations to the ones I belong to. Returns null for guests.
export async function loadShellData(currentSlug: string | null): Promise<ShellData | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, orgs, jar] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    listMyOrgs(),
    cookies(),
  ]);

  const currentOrg = currentSlug ? (orgs.find((o) => o.slug === currentSlug) ?? null) : null;
  const navSlug = currentOrg ? currentOrg.slug : pickOrgSlug(orgs.map((o) => o.slug), jar.get(LAST_ORG_COOKIE)?.value);
  return {
    user: { id: user.id, name: profile?.full_name ?? user.email ?? "Account", email: profile?.email ?? user.email ?? "" },
    orgs,
    currentOrg,
    navOrg: orgs.find((o) => o.slug === navSlug) ?? null,
  };
}
