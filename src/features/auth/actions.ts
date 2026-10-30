"use server";

import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { env } from "@/lib/env";
import { sanitizeNext } from "@/lib/route-guards";
import { createServerClient } from "@/lib/supabase/server";
import { mapAuthError } from "./map-error";
import {
  emailOnlySchema,
  oauthSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from "./schemas";

// Auth Server Actions (02_AppFlow S02-S06). Validate with Zod first, then call
// Supabase with the user's session. Never throw for expected errors.

function callbackUrl(next?: string | null): string {
  const url = new URL("/auth/callback", env.NEXT_PUBLIC_SITE_URL);
  const safe = sanitizeNext(next);
  if (safe) url.searchParams.set("next", safe);
  return url.toString();
}

export async function signUp(input: unknown): Promise<ActionResult<{ email: string }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { fullName, email, password } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, emailRedirectTo: callbackUrl() },
  });
  if (error) {
    const code = mapAuthError(error);
    return code === "E_VALIDATION" ? fail(code, { password: error.message }) : fail(code);
  }
  // With email confirmation on, an existing address also looks like success.
  return ok({ email });
}

export async function signIn(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);
  const { email, password, next } = parsed.data;

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail(mapAuthError(error));
  return ok({ redirectTo: sanitizeNext(next) ?? "/dashboard" });
}

export async function signOut(): Promise<ActionResult> {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  return error ? failFrom(error) : ok();
}

// Always the same answer, so the form cannot be used to find registered emails.
export async function forgotPassword(input: unknown): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl("/reset-password"),
  });
  if (error && mapAuthError(error) === "E_RATE_LIMIT") return fail("E_RATE_LIMIT");
  return ok();
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const code = mapAuthError(error);
    return code === "E_VALIDATION" ? fail(code, { password: error.message }) : fail(code);
  }
  return ok();
}

export async function resendConfirmation(input: unknown): Promise<ActionResult> {
  const parsed = emailOnlySchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error && mapAuthError(error) === "E_RATE_LIMIT") return fail("E_RATE_LIMIT");
  return ok();
}

// Returns the Google consent URL; the page navigates to it.
export async function startGoogleOAuth(input: unknown): Promise<ActionResult<{ url: string }>> {
  const parsed = oauthSchema.safeParse(input ?? {});
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(parsed.data.next), skipBrowserRedirect: true },
  });
  if (error || !data.url) return fail(error ? mapAuthError(error) : "E_UNKNOWN");
  return ok({ url: data.url });
}

// S17: change the display name. RLS lets a user update only their own profile.
export async function updateProfile(input: unknown): Promise<ActionResult<{ fullName: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("E_NOT_AUTHORIZED");

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id)
    .select("full_name")
    .maybeSingle();
  if (error) return failFrom(error);
  if (!data) return fail("E_NOT_FOUND");
  return ok({ fullName: data.full_name });
}
