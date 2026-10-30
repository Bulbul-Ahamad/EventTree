import { ResetForm } from "@/features/auth/components/reset-form";

// Middleware sends visitors without a (recovery) session to /forgot-password.
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-balance text-2xl font-bold">Set a new password</h1>
      <ResetForm />
    </>
  );
}
