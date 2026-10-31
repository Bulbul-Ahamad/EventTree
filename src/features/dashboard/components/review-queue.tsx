import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import type { ReviewItem } from "@/features/dashboard/queries";

// "Needs my review" (02_AppFlow S08). Hidden when there is nothing to review.
export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="needs-review" className="flex flex-col gap-3">
      <h2 id="needs-review" className="text-lg font-semibold">
        Needs my review <span className="text-foreground-muted">({items.length})</span>
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface shadow-sm">
        {items.map((item) => (
          <li key={item.nodeId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate font-medium">{item.title}</p>
              <p className="truncate text-sm text-foreground-muted">
                {item.eventTitle} · {item.assigneeName ?? "Unassigned"}
              </p>
              {item.submittedAt ? (
                <RelativeTime iso={item.submittedAt} prefix="Submitted" className="text-xs text-foreground-subtle" />
              ) : null}
            </div>
            <Link
              href={`/o/${encodeURIComponent(item.orgSlug)}/events/${item.eventId}?node=${item.nodeId}`}
              aria-label={`Review ${item.title}`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              Review
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
