import { CalendarPlus, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EventCard } from "@/features/events/components/event-card";
import { EventTabs } from "@/features/events/components/event-tabs";
import { listEvents, parseEventTab, type EventTab } from "@/features/events/queries";
import { getOrgBySlug } from "@/features/orgs/queries";

const EMPTY_TEXT: Record<Exclude<EventTab, "active">, string> = {
  completed: "No completed events yet.",
  archived: "No archived events.",
};

// S09 (02_AppFlow). RLS decides which events appear: org admins see all events of
// the organization, everyone else only the ones they take part in.
export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ orgSlug }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const tab = parseEventTab(rawTab);
  const events = await listEvents(org.id, tab);
  const newHref = `/o/${encodeURIComponent(org.slug)}/events/new`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">{org.name}</h1>
        <Link href={newHref} className={buttonVariants()}>
          <Plus aria-hidden /> New event
        </Link>
      </div>

      <EventTabs value={tab} />

      {events.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} orgSlug={org.slug} />
          ))}
        </ul>
      ) : tab === "active" ? (
        <EmptyState
          icon={CalendarPlus}
          title="No events yet"
          description="Events you create or take part in will show up here."
          action={
            <Link href={newHref} className={buttonVariants()}>
              Create your first event
            </Link>
          }
        />
      ) : (
        <p className="py-10 text-center text-sm text-foreground-muted">{EMPTY_TEXT[tab]}</p>
      )}
    </div>
  );
}
