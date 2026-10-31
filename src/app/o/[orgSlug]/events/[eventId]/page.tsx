import { notFound } from "next/navigation";
import { EventStatusBadge } from "@/components/ui/badge";
import { getEvent } from "@/features/events/queries";

// Placeholder so "Create event" has somewhere to land. Replaced by S11 (tree view)
// in step 3.06. 404 when the event does not exist or I cannot see it.
export default async function EventPlaceholder({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await getEvent(eventId);
  if (!event) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>
      <p className="text-sm text-foreground-muted">The event tree will appear here.</p>
    </div>
  );
}
