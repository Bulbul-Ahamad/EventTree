"use client";

import { useSyncExternalStore } from "react";
import { formatEventDates } from "@/lib/format-date";

const subscribe = () => () => {};

// Dates are shown in the browser's time zone, which the server cannot know, so
// they render after mount (same approach as the theme toggle). Until then a
// non-breaking space keeps the line height.
export function EventDates({ startsAt, endsAt, className }: { startsAt: string | null; endsAt: string | null; className?: string }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!startsAt && !endsAt) return null;
  return <p className={className}>{mounted ? formatEventDates(startsAt, endsAt) : " "}</p>;
}
