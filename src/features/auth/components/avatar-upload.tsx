"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { removeAvatar, uploadAvatar } from "@/features/auth/avatar-actions";
import { AVATAR_ACCEPT, MAX_AVATAR_BYTES } from "@/lib/avatar";
import { errorMessage } from "@/lib/errors";
import { notify } from "@/lib/toast";

// S17 profile picture (03_UI_Spec §8.12a). The checks here only give quick feedback; the server
// decides by the file's bytes and the bucket repeats the limits.
export function AvatarUpload({ userId, name, hasAvatar }: { userId: string; name: string; hasAvatar: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again must still fire a change
    if (!file) return;
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) return setError(errorMessage("E_FILE_TYPE"));
    if (file.size > MAX_AVATAR_BYTES) return setError(errorMessage("E_FILE_TOO_LARGE"));

    setError(null);
    startTransition(async () => {
      const body = new FormData();
      body.set("file", file);
      const result = await uploadAvatar(body);
      if (!result.ok) return setError(result.message);
      notify.success("Photo updated.");
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) return setError(result.message);
      notify.success("Photo removed.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Avatar id={userId} name={name} size="xl" aria-label={`Profile picture of ${name}`} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" loading={pending} onClick={() => input.current?.click()}>
            {pending ? "Uploading…" : hasAvatar ? "Change photo" : "Upload photo"}
          </Button>
          {hasAvatar ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={onRemove}>
              Remove photo
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept={AVATAR_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a profile picture"
        onChange={onPick}
      />
      <p className="text-xs text-foreground-muted">JPG, PNG or WebP, up to 2 MB.</p>
      <FormError message={error} />
    </div>
  );
}
