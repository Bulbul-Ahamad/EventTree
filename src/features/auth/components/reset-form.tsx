"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { resetPassword } from "@/features/auth/actions";
import { resetPasswordSchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { notify } from "@/lib/toast";
import { useFormAction } from "./use-form-action";

export function ResetForm() {
  const router = useRouter();
  const form = useFormAction();
  const [values, setValues] = useState({ password: "", confirm: "" });
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => resetPassword(values),
      () => {
        notify.success("Password updated.");
        router.push("/dashboard");
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField
        label="New password"
        required
        hint="At least 10 characters, with a letter and a number."
        error={form.fieldErrors.password}
      >
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set("password")} />}
      </FormField>
      <FormField label="Confirm password" required error={form.fieldErrors.confirm}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />}
      </FormField>
      <FormError message={form.formError} />
      <Button type="submit" loading={form.pending} className="w-full">
        Update password
      </Button>
    </form>
  );
}
