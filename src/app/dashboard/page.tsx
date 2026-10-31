import { createServerClient } from "@/lib/supabase/server";

// Temporary landing page so login can be verified. Replaced by S08 in step 3.05.
export default async function DashboardPlaceholder() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold md:text-3xl">Dashboard</h1>
      <p className="mt-2 text-sm text-foreground-muted">Signed in as {user?.email}</p>
    </div>
  );
}
