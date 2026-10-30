"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { resendConfirmation, signIn } from "@/features/auth/actions";
import { signInSchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { notify } from "@/lib/toast";
import { GoogleButton } from "./google-button";
import { useFormAction } from "./use-form-action";

export function LoginForm({ next, callbackFailed }: { next?: string | undefined; callbackFailed: boolean }) {
  const router = useRouter();
  const form = useFormAction();
  const [resending, startResend] = useTransition();
  const [values, setValues] = useState({ email: "", password: "" });
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = next ? { ...values, next } : values;
    const parsed = signInSchema.safeParse(payload);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => signIn(payload),
      ({ redirectTo }) => {
        router.push(redirectTo);
        router.refresh();
      },
    );
  }

  function resend() {
    startResend(async () => {
      const result = await resendConfirmation({ email: values.email });
      if (result.ok) notify.success("If the account needs it, we sent a new confirmation email.");
      else notify.error(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {callbackFailed ? <FormError message="That link is invalid or has expired. Please try again." /> : null}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Email" required error={form.fieldErrors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={set("email")} />}
        </FormField>
        <FormField label="Password" required error={form.fieldErrors.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={values.password} onChange={set("password")} />}
        </FormField>
        <FormError message={form.formError} />
        {form.errorCode === "E_EMAIL_NOT_CONFIRMED" ? (
          <Button variant="secondary" loading={resending} onClick={resend}>
            Resend confirmation email
          </Button>
        ) : null}
        <Button type="submit" loading={form.pending} className="w-full">
          Log in
        </Button>
        <Link href="/forgot-password" className="text-center text-sm font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </form>
      <GoogleButton next={next} />
      <p className="text-center text-sm text-foreground-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
