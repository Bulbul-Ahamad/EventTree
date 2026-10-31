"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { EventStatus } from "@/lib/permissions";
import {
  ancestorIds,
  flattenVisible,
  isOverdue,
  toggleExpanded,
  walk,
  type FilteredItem,
  type TreeNode,
  type VisibleRow,
} from "@/lib/tree";
import { cn } from "@/lib/utils";
import { treeKeyAction } from "./tree-keyboard";
import { TreeNodeRow } from "./tree-node-row";
import { useTreeExpanded } from "./use-tree-expanded";

// S11 tree (02_AppFlow, 03_UI_Spec §8.6): ARIA tree with one tab stop (roving
// tabindex), keyboard navigation, and expand state remembered per event.

type TreeViewProps = {
  root: TreeNode;
  eventId: string;
  eventStatus: EventStatus;
  selectedId?: string | null;
  // A filtered view: matching tasks as a flat list, each with its breadcrumb as caption.
  flatItems?: readonly FilteredItem[];
  pendingIds?: ReadonlySet<string>;
  onOpenNode: (id: string) => void;
  // Slots for later steps: the row ⋮ menu / verify tick, and the empty-container row.
  renderActions?: (node: TreeNode) => ReactNode;
  renderEmpty?: (node: TreeNode) => ReactNode;
  className?: string;
};

const NO_PENDING: ReadonlySet<string> = new Set();

function defaultEmpty(node: TreeNode): ReactNode {
  return node.type === "segment" ? "No tasks yet" : null;
}

export function TreeView({
  root,
  eventId,
  eventStatus,
  selectedId = null,
  flatItems,
  pendingIds = NO_PENDING,
  onOpenNode,
  renderActions,
  renderEmpty,
  className,
}: TreeViewProps) {
  const [expanded, setExpanded] = useTreeExpanded(eventId, root);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());

  // Opening a node (?node=) reveals it: expand its ancestors once per target.
  const revealedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId || revealedFor.current === selectedId) return;
    revealedFor.current = selectedId;
    const missing = ancestorIds(root, selectedId).filter((id) => !expanded.has(id));
    if (missing.length > 0) setExpanded(new Set([...expanded, ...missing]));
  }, [selectedId, root, expanded, setExpanded]);

  const rows = useMemo<VisibleRow[]>(
    () =>
      flatItems
        ? flatItems.map(({ node }) => ({ node, level: 0, hasChildren: false, expanded: false }))
        : flattenVisible(root, expanded),
    [root, expanded, flatItems],
  );
  const captions = useMemo(
    () => new Map(flatItems?.map((i) => [i.node.id, i.breadcrumb.map((b) => b.title).join(" › ")])),
    [flatItems],
  );
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const positions = useMemo(() => {
    const map = new Map<string, { pos: number; size: number }>([[root.id, { pos: 1, size: 1 }]]);
    if (flatItems) {
      flatItems.forEach((i, idx) => map.set(i.node.id, { pos: idx + 1, size: flatItems.length }));
      return map;
    }
    for (const n of walk(root)) n.children.forEach((c, i) => map.set(c.id, { pos: i + 1, size: n.children.length }));
    return map;
  }, [root, flatItems]);

  // Overdue is decided once per render so every row agrees (BR-09).
  const now = new Date();

  const tabbableId =
    (focusedId && rows.some((r) => r.node.id === focusedId) ? focusedId : null) ??
    (selectedId && rows.some((r) => r.node.id === selectedId) ? selectedId : null) ??
    rows[0]?.node.id ??
    null;

  const onToggle = useCallback(
    (id: string) => setExpanded(toggleExpanded(expanded, id)),
    [expanded, setExpanded],
  );
  const onFocusRow = useCallback((id: string) => setFocusedId(id), []);

  const onKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, id: string) => {
      if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
      const index = rowsRef.current.findIndex((r) => r.node.id === id);
      const action = treeKeyAction(rowsRef.current, index, e.key);
      if (!action) return;
      e.preventDefault();
      if (action.type === "focus") {
        setFocusedId(action.id);
        rowEls.current.get(action.id)?.focus();
      } else if (action.type === "toggle") {
        const next = new Set(expanded);
        if (action.open) next.add(action.id);
        else next.delete(action.id);
        setExpanded(next);
      } else {
        onOpenNode(action.id);
      }
    },
    [expanded, setExpanded, onOpenNode],
  );

  const refFor = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) rowEls.current.set(id, el);
      else rowEls.current.delete(id);
    },
    [],
  );

  return (
    <div role="tree" aria-label={`${root.title} tasks`} className={cn("flex flex-col", className)}>
      {rows.map(({ node, level, hasChildren, expanded: open }) => {
        const pos = positions.get(node.id) ?? { pos: 1, size: 1 };
        const empty = node.type !== "task" && !hasChildren ? (renderEmpty ?? defaultEmpty)(node) : null;
        return (
          <Fragment key={node.id}>
            <TreeNodeRow
              node={node}
              level={level}
              hasChildren={hasChildren}
              expanded={open}
              selected={node.id === selectedId}
              tabbable={node.id === tabbableId}
              pending={pendingIds.has(node.id)}
              overdue={isOverdue(node, { userId: "", eventStatus, now })}
              caption={captions.get(node.id) || undefined}
              posInSet={pos.pos}
              setSize={pos.size}
              rowRef={refFor(node.id)}
              actions={renderActions}
              onToggle={onToggle}
              onOpen={onOpenNode}
              onFocusRow={onFocusRow}
              onKey={onKey}
            />
            {empty ? (
              <div
                role="none"
                style={{ paddingLeft: `calc(${level + 1} * 1.25rem + 0.5rem + 2.75rem)` }}
                className="flex min-h-9 items-center gap-2 pr-2 text-sm text-foreground-muted"
              >
                {empty}
              </div>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
