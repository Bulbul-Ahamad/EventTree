import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Card, CardTitle } from "@/components/ui/card";
import { EventDangerZone } from "@/features/events/components/event-danger-zone";
import { EventSettingsForm } from "@/features/events/components/event-settings-form";
import { getEvent, getEventContext } from "@/features/events/queries";
import { canDeleteEvent, canEditEventSettings } from "@/lib/permissions";

// S14 (02_AppFlow), Owner only. An unknown or invisible event is a 404; a
// viewer who is not the owner goes back to the event page.
export default async function EventSettingsPage({ params }: { params: Promise<{ orgSlug: string; eventId: string }> }) {
  const { orgSlug, eventId } = await params;
  const [event, ctx] = await Promise.all([getEvent(eventId), getEventContext(eventId)]);
  if (!event || !ctx) notFound();
  const slug = encodeURIComponent(orgSlug);
  const eventHref = `/o/${slug}/events/${eventId}`;
  if (!canEditEventSettings(ctx)) redirect(eventHref);

  const readOnly = event.status === "completed" || event.status === "archived";
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">Event settings</h1>
        <Link href={eventHref} className="text-sm font-medium text-primary hover:underline">
          Back to {event.title}
        </Link>
      </div>
      {readOnly ? (
        <Banner variant="readonly" className="rounded-lg">
          This event is read-only, so its details cannot be changed.
        </Banner>
      ) : null}
      <Card>
        <CardTitle>Details</CardTitle>
        <EventSettingsForm event={event} readOnly={readOnly} />
      </Card>
      <EventDangerZone
        eventId={event.id}
        title={event.title}
        canDelete={canDeleteEvent(ctx)}
        eventsHref={`/o/${slug}/events`}
      />
    </div>
  );
}
