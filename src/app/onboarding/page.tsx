import Link from "next/link";
import { OnboardingForms } from "@/features/orgs/components/onboarding-forms";
import { createServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const { count } = await supabase
    .from("org_members")
    .select("org_id", { count: "exact", head: true });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">Set up your organization</h1>
        <p className="text-sm text-foreground-muted">
          Create a club or program, or join one with a code.
        </p>
        {/* Rule 4: users who already have an org may still come here. */}
        {count && count > 0 ? (
          <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">
            Back to dashboard
          </Link>
        ) : null}
      </div>
      <OnboardingForms />
    </main>
  );
}
