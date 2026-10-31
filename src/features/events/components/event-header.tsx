import { Avatar } from "@/components/ui/avatar";
import { EventStatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { EventDates } from "@/components/ui/event-dates";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { EventDetail } from "@/features/events/queries";
import { EventLifecycle } from "./event-lifecycle";

// S11 header (02_AppFlow): title, status, overall progress, dates and location,
// lifecycle buttons for the Owner only, and the draft / read-only banner.
type Props = {
  event: EventDetail;
  isOwner: boolean;
  unassignedCount: number;
  settingsHref: string;
};

export function EventHeader({ event, isOwner, unassignedCount, settingsHref }: Props) {
  const readOnly = event.status === "completed" || event.status === "archived";
  return (
    <header className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {event.status === "draft" ? (
        <Banner variant="draft">Draft — task updates are disabled until the owner activates the event.</Banner>
      ) : null}
      {readOnly ? <Banner variant="readonly">This event is read-only.</Banner> : null}
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-balance text-2xl font-bold md:text-3xl">{event.title}</h1>
              <EventStatusBadge status={event.status} />
            </div>
            <EventDates startsAt={event.startsAt} endsAt={event.endsAt} className="text-sm text-foreground-muted" />
            {event.location ? <p className="text-sm text-foreground-muted">{event.location}</p> : null}
            {event.ownerId ? (
              <p className="flex items-center gap-2 pt-1 text-sm text-foreground-muted">
                <Avatar id={event.ownerId} name={event.ownerName} size="sm" />
                <span className="truncate">Owner: {event.ownerName ?? "Unknown"}</span>
              </p>
            ) : null}
          </div>
          {isOwner ? (
            <EventLifecycle
              eventId={event.id}
              status={event.status}
              progress={event.progress}
              unassignedCount={unassignedCount}
              settingsHref={settingsHref}
            />
          ) : null}
        </div>
        <ProgressBar value={event.progress} size="header" label={`${event.title} overall progress`} />
      </div>
    </header>
  );
}
