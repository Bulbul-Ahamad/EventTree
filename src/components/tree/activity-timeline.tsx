import { Link2, MessageSquare, Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { STATUS_LABELS } from "@/components/ui/badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem } from "@/features/updates/queries";

// S12 activity (02_AppFlow, US-14): who, when and what, newest first. All user
// text is plain text; links open in a new tab and only http(s) is linked.

function safeHref(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function What({ item }: { item: ActivityItem }) {
  if (item.kind === "status_change") {
    const from = item.fromStatus ? STATUS_LABELS[item.fromStatus] : "—";
    const to = item.toStatus ? STATUS_LABELS[item.toStatus] : "—";
    return (
      <>
        <p className="flex items-center gap-1 text-sm">
          <Repeat aria-hidden className="size-4 shrink-0 text-foreground-muted" />
          Changed status from <strong>{from}</strong> to <strong>{to}</strong>
        </p>
        {item.body ? <p className="whitespace-pre-wrap break-words text-sm text-foreground-muted">{item.body}</p> : null}
      </>
    );
  }
  if (item.kind === "proof_link") {
    const href = safeHref(item.linkUrl);
    return (
      <>
        <p className="flex items-start gap-1 text-sm">
          <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground-muted" />
          Added a proof link:
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 break-all text-primary underline">
              {item.linkUrl}
            </a>
          ) : (
            <span className="min-w-0 break-all">{item.linkUrl}</span>
          )}
        </p>
        {item.body ? <p className="whitespace-pre-wrap break-words text-sm text-foreground-muted">{item.body}</p> : null}
      </>
    );
  }
  return (
    <p className="flex items-start gap-1 text-sm">
      <MessageSquare aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground-muted" />
      <span className="min-w-0 whitespace-pre-wrap break-words">{item.body}</span>
    </p>
  );
}

// `items` null = still loading.
export function ActivityTimeline({ items }: { items: ActivityItem[] | null }) {
  if (items === null) {
    return (
      <div role="status" aria-label="Loading activity" className="flex flex-col gap-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  if (items.length === 0) return <p className="text-sm text-foreground-muted">No activity yet.</p>;
  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <Avatar id={item.authorId} name={item.authorName} size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{item.authorName ?? "Unknown"}</span>
              <RelativeTime iso={item.createdAt} className="text-xs text-foreground-muted" />
            </p>
            <What item={item} />
          </div>
        </li>
      ))}
    </ol>
  );
}
