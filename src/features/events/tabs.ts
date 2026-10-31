// Tabs of the events list (02_AppFlow S09). Kept out of queries.ts because that file is
// server-only and the tab control is a client component.

export const EVENT_TABS = ["active", "completed", "archived"] as const;
export type EventTab = (typeof EVENT_TABS)[number];

export function parseEventTab(value: string | null | undefined): EventTab {
  return (EVENT_TABS as readonly string[]).includes(value ?? "") ? (value as EventTab) : "active";
}
