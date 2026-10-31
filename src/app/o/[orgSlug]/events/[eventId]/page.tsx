import { notFound } from "next/navigation";
import { EventTree } from "@/components/tree/event-tree";
import { EventHeader } from "@/features/events/components/event-header";
import { getEvent, getEventContext } from "@/features/events/queries";
import { getEventTree } from "@/features/nodes/queries";
import { isEventOwner } from "@/lib/permissions";
import { walk } from "@/lib/tree";

// S11 (02_AppFlow). The node form arrives in 3.08, the detail panel in 3.09.
// 404 when the event does not exist or I cannot see it.
export default async function EventPage({ params }: { params: Promise<{ orgSlug: string; eventId: string }> }) {
  const { orgSlug, eventId } = await params;
  const [event, root, ctx] = await Promise.all([getEvent(eventId), getEventTree(eventId), getEventContext(eventId)]);
  if (!event || !root || !ctx) notFound();

  const unassignedCount = walk(root).filter((n) => n.assignee_id === null).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <EventHeader
        event={event}
        isOwner={isEventOwner(ctx)}
        unassignedCount={unassignedCount}
        settingsHref={`/o/${encodeURIComponent(orgSlug)}/events/${eventId}/settings`}
      />
      <EventTree root={root} eventStatus={event.status} userId={ctx.userId} />
    </div>
  );
}
