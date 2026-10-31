"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import type { EventStatus } from "@/lib/permissions";
import type { TreeNode } from "@/lib/tree";
import { TreeView } from "./tree-view";

// The tree wired to the URL: the selected row is `?node=<id>` (02_AppFlow S11/S12),
// so the detail panel (3.09) and shared links work from the same parameter.
export function EventTree({ root, eventStatus }: { root: TreeNode; eventStatus: EventStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onOpenNode = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("node", id);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <TreeView
      root={root}
      eventId={root.id}
      eventStatus={eventStatus}
      selectedId={params.get("node")}
      onOpenNode={onOpenNode}
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    />
  );
}
