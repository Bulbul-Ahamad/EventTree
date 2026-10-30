import { redirect } from "next/navigation";
import { ResendButton } from "@/features/auth/components/resend-button";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { email } = await searchParams;
  if (typeof email !== "string" || email.length === 0) redirect("/signup");

  return (
    <>
      <h1 className="text-balance text-2xl font-bold">Check your email</h1>
      <p className="text-sm text-foreground-muted">
        We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
        Open it to finish creating your account.
      </p>
      <ResendButton email={email} />
    </>
  );
}
