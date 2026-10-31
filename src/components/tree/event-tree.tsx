"use client";

import { SearchX } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { EventStatus } from "@/lib/permissions";
import { filterTasks, parseFilter, type TreeFilter, type TreeNode } from "@/lib/tree";
import { TreeView } from "./tree-view";

const FILTER_OPTIONS: ReadonlyArray<{ value: TreeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "mine", label: "Mine" },
  { value: "overdue", label: "Overdue" },
  { value: "review", label: "Needs review" },
];

// The tree wired to the URL (02_AppFlow S11): the selected row is `?node=<id>`
// (S12 reads the same parameter) and the filter is `?filter=`.
export function EventTree({
  root,
  eventStatus,
  userId,
}: {
  root: TreeNode;
  eventStatus: EventStatus;
  userId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilter(params.get("filter"));

  const go = useCallback(
    (change: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      change(next);
      const query = next.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const onOpenNode = useCallback((id: string) => go((q) => q.set("node", id)), [go]);
  const setFilter = useCallback(
    (value: TreeFilter) => go((q) => (value === "all" ? q.delete("filter") : q.set("filter", value))),
    [go],
  );

  const items = useMemo(
    () => (filter === "all" ? undefined : filterTasks(root, filter, { userId, eventStatus, now: new Date() })),
    [filter, root, userId, eventStatus],
  );

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        aria-label="Filter tasks"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        className="self-start"
      />
      {items && items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <EmptyState
            icon={SearchX}
            title="No tasks match this filter."
            action={
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Clear filter
              </Button>
            }
          />
        </div>
      ) : (
        <TreeView
          root={root}
          eventId={root.id}
          eventStatus={eventStatus}
          selectedId={params.get("node")}
          flatItems={items}
          onOpenNode={onOpenNode}
          className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
        />
      )}
    </div>
  );
}
