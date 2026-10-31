import { notFound } from "next/navigation";
import { EventTree } from "@/components/tree/event-tree";
import { EventStatusBadge } from "@/components/ui/badge";
import { getEvent } from "@/features/events/queries";
import { getEventTree } from "@/features/nodes/queries";

// S11 (02_AppFlow). The header, filters and banners arrive in 3.07, the detail
// panel in 3.09. 404 when the event does not exist or I cannot see it.
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const [event, root] = await Promise.all([getEvent(eventId), getEventTree(eventId)]);
  if (!event || !root) notFound();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">{event.title}</h1>
        <EventStatusBadge status={event.status} />
      </div>
      <EventTree root={root} eventStatus={event.status} />
    </div>
  );
}
