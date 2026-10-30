import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Placeholder landing for an organization. Replaced by S09 in step 3.04.
// RLS only returns organizations the user belongs to, so others get 404.
export default async function EventsPlaceholder({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const supabase = await createServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold md:text-3xl">{org.name}</h1>
      <p className="mt-2 text-sm text-foreground-muted">Events will appear here.</p>
    </main>
  );
}
