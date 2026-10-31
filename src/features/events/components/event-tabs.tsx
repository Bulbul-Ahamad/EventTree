"use client";

import { usePathname, useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EVENT_TABS, type EventTab } from "@/features/events/tabs";

const LABELS: Record<EventTab, string> = { active: "Active", completed: "Completed", archived: "Archived" };

// 02_AppFlow S09 tabs. The tab lives in the URL (?tab=) so it survives reloads and
// can be shared; "active" is the default and keeps the URL clean.
export function EventTabs({ value }: { value: EventTab }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SegmentedControl
      aria-label="Event status"
      value={value}
      onChange={(tab) => router.replace(tab === "active" ? pathname : `${pathname}?tab=${tab}`)}
      options={EVENT_TABS.map((t) => ({ value: t, label: LABELS[t] }))}
    />
  );
}
