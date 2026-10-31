"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { defaultExpandedIds, type TreeNode } from "@/lib/tree";

// Which tree rows are expanded, remembered per event in localStorage (03_UI_Spec
// §8.6). Storage can be missing or throw (private windows, blocked site data), so
// every access is wrapped and an in-memory copy keeps the tree working.

const PREFIX = "et:tree-expanded:";
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) return stored;
  } catch {
    // fall through to memory
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // memory copy is enough
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// Pure: stored JSON -> ids, or null when nothing usable is stored.
export function parseStoredIds(raw: string | null): string[] | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
  } catch {
    // corrupt value: use the defaults
  }
  return null;
}

export function useTreeExpanded(eventId: string, root: TreeNode) {
  const key = PREFIX + eventId;
  // The server and the first client render use the defaults, then the saved set applies.
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const expanded = useMemo(() => {
    const ids = parseStoredIds(raw);
    return ids ? new Set(ids) : defaultExpandedIds(root);
  }, [raw, root]);
  const setExpanded = useCallback(
    (next: ReadonlySet<string>) => write(key, JSON.stringify([...next])),
    [key],
  );
  return [expanded, setExpanded] as const;
}
