import { notFound } from "next/navigation";
import { getOrgBySlug } from "@/features/orgs/queries";

// Placeholder so the nav link works. Replaced by S16 in its own plan step.
// Guard rule 7: only org admins; everyone else gets 404.
export default async function OrgSettingsPlaceholder({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org || org.role !== "admin") notFound();
  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <h1 className="text-2xl font-bold md:text-3xl">Organization settings</h1>
      <p className="mt-2 text-sm text-foreground-muted">Settings for {org.name} will appear here.</p>
    </div>
  );
}
