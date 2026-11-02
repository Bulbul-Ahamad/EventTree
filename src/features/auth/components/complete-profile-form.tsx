"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { completeProfile } from "@/features/auth/actions";
import { completeProfileSchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { useFormAction } from "./use-form-action";

// S19: the only thing a signed-in user without a phone number can do besides log out.
export function CompleteProfileForm({ next }: { next?: string | undefined }) {
  const router = useRouter();
  const form = useFormAction();
  const [phone, setPhone] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { phone, next };
    const parsed = completeProfileSchema.safeParse(input);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => completeProfile(input),
      ({ redirectTo }) => {
        router.push(redirectTo);
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField
        label="Phone number"
        required
        hint="Like 01712345678 or +8801712345678. People in your organizations can see it."
        error={form.fieldErrors.phone}
      >
        {(p) => (
          <Input {...p} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        )}
      </FormField>
      <FormError message={form.formError} />
      <Button type="submit" loading={form.pending} className="w-full">
        Save and continue
      </Button>
    </form>
  );
}
