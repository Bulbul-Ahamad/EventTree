import { CalendarX } from "lucide-react";
import Link from "next/link";
import { EventStatusBadge, RoleChip } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { MyEvent } from "@/features/dashboard/queries";

// "My events" (02_AppFlow S08): title, org, status, progress, my role.
// `createHref` points at the last organization used; null when there is none.
export function MyEvents({ events, createHref }: { events: MyEvent[]; createHref: string | null }) {
  return (
    <section aria-labelledby="my-events" className="flex flex-col gap-3">
      <h2 id="my-events" className="text-lg font-semibold">
        My events
      </h2>
      {events.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title="You're not part of any event yet."
          action={
            createHref ? (
              <Link href={createHref} className={buttonVariants()}>
                Create event
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="relative flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors duration-150 hover:bg-surface-muted md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <h3 className="text-balance text-base font-semibold">
                    <Link
                      href={`/o/${encodeURIComponent(e.orgSlug)}/events/${e.id}`}
                      className="rounded-sm after:absolute after:inset-0 after:content-['']"
                    >
                      {e.title}
                    </Link>
                  </h3>
                  <p className="truncate text-sm text-foreground-muted">{e.orgName}</p>
                </div>
                <EventStatusBadge status={e.status} />
              </div>
              <ProgressBar value={e.progress} label={`${e.title} progress`} />
              <div>
                <RoleChip role={e.role} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
