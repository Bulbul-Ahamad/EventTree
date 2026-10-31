import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { NewEventForm } from "@/features/events/components/new-event-form";
import { getOrgBySlug } from "@/features/orgs/queries";

// S10 (02_AppFlow). Any member of the organization may open it; the database
// decides whether the event can be created.
export default async function NewEventPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">New event</h1>
        <Link href={`/o/${encodeURIComponent(org.slug)}/events`} className="text-sm font-medium text-primary hover:underline">
          Back to events
        </Link>
      </div>
      <Card>
        <NewEventForm orgId={org.id} orgSlug={org.slug} />
      </Card>
    </div>
  );
}
