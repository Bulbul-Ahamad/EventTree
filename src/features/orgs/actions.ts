"use server";

import { revalidatePath } from "next/cache";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { toErrorCode } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import {
  createOrganizationSchema,
  joinOrganizationSchema,
  leaveOrganizationSchema,
  removeMemberSchema,
  rotateJoinCodeSchema,
  setMemberRoleSchema,
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
  if (error) return failFrom(error);
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
  if (error) return failFrom(error);
  revalidatePath("/", "layout");
  return ok();
}
