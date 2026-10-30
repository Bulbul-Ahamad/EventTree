"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { signUp } from "@/features/auth/actions";
import { signUpSchema } from "@/features/auth/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { GoogleButton } from "./google-button";
import { useFormAction } from "./use-form-action";

export function SignUpForm() {
  const router = useRouter();
  const form = useFormAction();
  const [values, setValues] = useState({ fullName: "", email: "", password: "" });
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => signUp(values),
      ({ email }) => router.push(`/signup/check-email?email=${encodeURIComponent(email)}`),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Full name" required error={form.fieldErrors.fullName}>
          {(p) => <Input {...p} autoComplete="name" value={values.fullName} onChange={set("fullName")} />}
        </FormField>
        <FormField label="Email" required error={form.fieldErrors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={set("email")} />}
        </FormField>
        <FormField
          label="Password"
          required
          hint="At least 10 characters, with a letter and a number."
          error={form.fieldErrors.password}
        >
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set("password")} />}
        </FormField>
        <FormError message={form.formError} />
        <Button type="submit" loading={form.pending} className="w-full">
          Create account
        </Button>
      </form>
      <GoogleButton />
      <p className="text-center text-sm text-foreground-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
