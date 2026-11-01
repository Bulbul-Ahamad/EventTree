"use server";

import { revalidatePath } from "next/cache";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { errorMessage, toErrorCode } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import {
  createOrganizationSchema,
  joinOrganizationSchema,
  leaveOrganizationSchema,
  removeMemberSchema,
  rotateJoinCodeSchema,
  setMemberRoleSchema,
  updateOrganizationSchema,
} from "./schemas";

// Org Server Actions (02_AppFlow S07). Rules live in the RPCs; this layer
// validates input and maps errors.

export async function createOrganization(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { name, slug, kind } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("create_organization", {
    p_name: name,
    p_slug: slug,
    p_kind: kind,
  });
  if (error) {
    const code = toErrorCode(error);
    if (code === "E_SLUG_TAKEN") return fail(code, { slug: "This URL name is taken" });
    return failFrom(error);
  }
  return ok({ slug: data.slug });
}

export async function joinOrganization(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const parsed = joinOrganizationSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("join_org_by_code", { p_code: parsed.data.code });
  if (error) {
    const code = toErrorCode(error);
    if (code === "E_INVALID_JOIN_CODE") return fail(code, { code: "Invalid or expired code" });
    return failFrom(error);
  }
  return ok({ slug: data.slug });
}

// ---- member management (S15). Authority and guards are in the RPCs. --------

const MEMBERS_PAGE = "/o/[orgSlug]/members";

// E_OWNS_EVENTS comes with the number of events the person owns (S15). Any
// other error is mapped as usual. The count is only for the message; the
// database already refused the change.
async function removalFailure(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  error: unknown,
  orgId: string,
  userId: string,
): Promise<ActionResult<never>> {
  const code = toErrorCode(error);
  if (code !== "E_OWNS_EVENTS") return fail(code);
  const { count } = await supabase
    .from("nodes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("type", "event")
    .eq("assignee_id", userId);
  const base = errorMessage(code);
  return { ok: false, code, message: count ? `${base} (Events they own: ${count})` : base };
}

export async function rotateJoinCode(input: unknown): Promise<ActionResult<{ joinCode: string }>> {
  const parsed = rotateJoinCodeSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("rotate_join_code", { p_org: parsed.data.orgId });
  if (error) return failFrom(error);
  revalidatePath(MEMBERS_PAGE, "page");
  return ok({ joinCode: data });
}

export async function setMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = setMemberRoleSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { orgId, userId, role } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_org_member_role", {
    p_org: orgId,
    p_user: userId,
    p_role: role,
  });
  if (error) return failFrom(error);
  revalidatePath(MEMBERS_PAGE, "page");
  return ok();
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("remove_org_member", {
    p_org: parsed.data.orgId,
    p_user: parsed.data.userId,
  });
  if (error) return removalFailure(supabase, error, parsed.data.orgId, parsed.data.userId);
  revalidatePath(MEMBERS_PAGE, "page");
  return ok();
}

// Leave = remove myself (the RPC allows self-removal for any member).
export async function leaveOrganization(input: unknown): Promise<ActionResult> {
  const parsed = leaveOrganizationSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("E_NOT_AUTHORIZED");

  const { error } = await supabase.rpc("remove_org_member", {
    p_org: parsed.data.orgId,
    p_user: user.id,
  });
  if (error) return removalFailure(supabase, error, parsed.data.orgId, user.id);
  revalidatePath("/", "layout");
  return ok();
}

// S16. Only admins may update (RLS); an update that touches no row means the
// organization is hidden from me or I am not an admin.
export async function updateOrganization(input: unknown): Promise<ActionResult> {
  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { orgId, name, kind } = parsed.data;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ name, kind })
    .eq("id", orgId)
    .select("id")
    .maybeSingle();
  if (error) return failFrom(error);
  if (!data) return fail("E_NOT_AUTHORIZED");
  revalidatePath("/", "layout");
  return ok();
}
