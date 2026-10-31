import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EventStatusBadge } from "@/components/ui/badge";
import { EventDates } from "@/components/ui/event-dates";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { EventSummary } from "@/features/events/queries";

// 03_UI_Spec / 02_AppFlow S09: title, dates, status badge, progress, owner avatar.
// The whole card is one link (the title is its accessible name).
export function EventCard({ event, orgSlug }: { event: EventSummary; orgSlug: string }) {
  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-150 hover:bg-surface-muted md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-balance text-lg font-semibold">
          <Link
            href={`/o/${encodeURIComponent(orgSlug)}/events/${event.id}`}
            className="rounded-sm after:absolute after:inset-0 after:content-['']"
          >
            {event.title}
          </Link>
        </h2>
        <EventStatusBadge status={event.status} />
      </div>
      <EventDates startsAt={event.startsAt} endsAt={event.endsAt} className="text-sm text-foreground-muted" />
      <ProgressBar value={event.progress} label={`${event.title} progress`} />
      <div className="flex items-center gap-2 text-sm text-foreground-muted">
        {event.ownerId ? <Avatar id={event.ownerId} name={event.ownerName} size="sm" /> : null}
        <span className="truncate">{event.ownerName ? `Owner: ${event.ownerName}` : "No owner"}</span>
      </div>
    </li>
  );
}
