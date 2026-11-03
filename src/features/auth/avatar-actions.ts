"use server";

import { z } from "zod";
import { fail, failFrom, failValidation, ok, type ActionResult } from "@/lib/action-result";
import { AVATAR_BUCKET, MAX_AVATAR_BYTES, avatarPath, avatarValue } from "@/lib/avatar";
import { detectImageType } from "@/lib/image-type";
import { createServerClient } from "@/lib/supabase/server";

// S17 profile picture (US-18). The server decides the type from the file's bytes and checks the
// size before anything is uploaded; the bucket repeats both limits. RLS lets a user write only
// inside their own folder.

const uploadSchema = z.object({ file: z.instanceof(File, { message: "Choose an image." }) }).strict();

async function currentUserId() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  const parsed = uploadSchema.safeParse({ file: formData.get("file") });
  if (!parsed.success) return failValidation(parsed.error);
  const { file } = parsed.data;

  if (file.size > MAX_AVATAR_BYTES) return fail("E_FILE_TOO_LARGE");
  if (file.size === 0) return fail("E_FILE_TYPE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) return fail("E_FILE_TYPE");

  const { supabase, userId } = await currentUserId();
  if (!userId) return fail("E_NOT_AUTHORIZED");

  const uploaded = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath(userId), bytes, { contentType: type, upsert: true, cacheControl: "3600" });
  if (uploaded.error) {
    if (/maximum allowed size|too large/i.test(uploaded.error.message)) return fail("E_FILE_TOO_LARGE");
    if (/mime type|not supported/i.test(uploaded.error.message)) return fail("E_FILE_TYPE");
    return failFrom(uploaded.error);
  }

  const avatarUrl = avatarValue(userId, Date.now());
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) return failFrom(error);
  if (!data) return fail("E_NOT_FOUND");
  return ok({ avatarUrl });
}

export async function removeAvatar(): Promise<ActionResult> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return fail("E_NOT_AUTHORIZED");

  const removed = await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath(userId)]);
  if (removed.error) return failFrom(removed.error);

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  return error ? failFrom(error) : ok();
}
