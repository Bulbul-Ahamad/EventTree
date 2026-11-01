import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { OrgSettingsForm } from "@/features/orgs/components/org-settings-form";
import { getOrgBySlug } from "@/features/orgs/queries";

// S16 (02_AppFlow). Guard rule 7: only org admins; everyone else gets 404.
export default async function OrgSettingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org || org.role !== "admin") notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <h1 className="text-balance text-2xl font-bold md:text-3xl">Organization settings</h1>
      <Card>
        <CardTitle>Details</CardTitle>
        <OrgSettingsForm org={{ id: org.id, name: org.name, slug: org.slug, kind: org.kind }} />
      </Card>
    </div>
  );
}
