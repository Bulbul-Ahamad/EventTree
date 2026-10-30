import { ForgotForm } from "@/features/auth/components/forgot-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-balance text-2xl font-bold">Forgot your password?</h1>
      <p className="text-sm text-foreground-muted">
        Enter your email and we will send you a link to reset it.
      </p>
      <ForgotForm />
    </>
  );
}
