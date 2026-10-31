"use client";

import { AlertCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { formatDateTime, formatOverdue, formatRelative } from "@/lib/format-date";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

// Relative text with the absolute date in the tooltip (02_AppFlow §1). The current
// time and zone are only known in the browser, so it renders after mount.
type Props = { iso: string; prefix?: string; overdue?: boolean; tooltip?: boolean; className?: string };

export function RelativeTime({ iso, prefix, overdue = false, tooltip = true, className }: Props) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <span className={className}>{" "}</span>;

  const now = new Date();
  const text = overdue ? formatOverdue(iso, now) : `${prefix ? `${prefix} ` : ""}${formatRelative(iso, now)}`;
  const time = (
    <time
      dateTime={iso}
      className={cn("inline-flex items-center gap-1", overdue && "font-medium text-danger", className)}
    >
      {overdue ? <AlertCircle aria-hidden className="size-3.5 shrink-0" /> : null}
      {text}
    </time>
  );
  // Long lists (the tree) turn the tooltip off: one provider per row is wasted work.
  if (!tooltip) return time;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip content={formatDateTime(iso)}>{time}</Tooltip>
    </TooltipProvider>
  );
}
