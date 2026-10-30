"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { updateProfile } from "@/features/auth/actions";
import { updateProfileSchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { notify } from "@/lib/toast";
import { useFormAction } from "./use-form-action";

export function ProfileForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const form = useFormAction();
  const [name, setName] = useState(initialName);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = updateProfileSchema.safeParse({ fullName: name });
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => updateProfile({ fullName: name }),
      ({ fullName }) => {
        setName(fullName);
        notify.success("Profile saved.");
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Full name" required error={form.fieldErrors.fullName}>
        {(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Email" hint="Your email cannot be changed here.">
        {(p) => <Input {...p} type="email" value={email} disabled readOnly />}
      </FormField>
      <FormError message={form.formError} />
      <Button type="submit" loading={form.pending} className="self-start">
        Save
      </Button>
    </form>
  );
}
