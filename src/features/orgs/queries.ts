import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { OrgKind } from "./schemas";

// Org reads for Server Components (TRD §6). RLS decides what comes back:
// a user only sees organizations and members of organizations they belong to.

export type OrgRole = "admin" | "member";

export type MyOrg = { id: string; name: string; slug: string; kind: OrgKind; role: OrgRole };

export type OrgMember = {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: OrgRole;
  joinedAt: string;
};

export type OrgDetail = MyOrg & {
  // Only filled for admins (02_AppFlow S15); members never get the code from here.
  joinCode: string | null;
};

async function currentUserId() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

// Organizations I belong to, with my role in each. Used by the org switcher.
export async function listMyOrgs(): Promise<MyOrg[]> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from("org_members")
    .select("role, organizations(id, name, slug, kind)")
    .eq("user_id", userId);
  if (error) throw new Error("E_UNKNOWN");

  return data
    .flatMap((m) =>
      m.organizations
        ? [{ ...m.organizations, kind: m.organizations.kind as OrgKind, role: m.role as OrgRole }]
        : [],
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

// One organization by slug, or null when it does not exist or I am not a member.
export async function getOrgBySlug(slug: string): Promise<OrgDetail | null> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, kind, join_code")
    .eq("slug", slug)
    .maybeSingle();
  if (!org) return null;

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", org.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const role = membership.role as OrgRole;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    kind: org.kind as OrgKind,
    role,
    joinCode: role === "admin" ? org.join_code : null,
  };
}

// Members of an organization I belong to (empty for anyone else), admins first.
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { supabase } = await currentUserId();
  const { data, error } = await supabase
    .from("org_members")
    .select("user_id, role, joined_at, profiles(full_name, email, avatar_url)")
    .eq("org_id", orgId);
  if (error) throw new Error("E_UNKNOWN");

  return data
    .flatMap((m) =>
      m.profiles
        ? [
            {
              userId: m.user_id,
              fullName: m.profiles.full_name,
              email: m.profiles.email,
              avatarUrl: m.profiles.avatar_url,
              role: m.role as OrgRole,
              joinedAt: m.joined_at,
            },
          ]
        : [],
    )
    .sort(
      (a, b) =>
        Number(b.role === "admin") - Number(a.role === "admin") || a.fullName.localeCompare(b.fullName),
    );
}
