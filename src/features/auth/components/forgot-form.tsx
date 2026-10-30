"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "@/features/auth/actions";
import { emailOnlySchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { useFormAction } from "./use-form-action";

export function ForgotForm() {
  const form = useFormAction();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(() => forgotPassword({ email }), () => setSent(true));
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-md bg-success-soft p-3 text-sm text-foreground">
          If an account exists, we sent a link.
        </p>
        <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Email" required error={form.fieldErrors.email}>
        {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </FormField>
      <FormError message={form.formError} />
      <Button type="submit" loading={form.pending} className="w-full">
        Send reset link
      </Button>
      <Link href="/login" className="text-center text-sm font-medium text-primary hover:underline">
        Back to log in
      </Link>
    </form>
  );
}
