"use server";

import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { toErrorCode } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";
import { createOrganizationSchema, joinOrganizationSchema } from "./schemas";

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
