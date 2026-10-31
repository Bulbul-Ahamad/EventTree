"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// Searchable select (03_UI_Spec §8.2, 8.7 "Select (searchable)"), built on the
// Radix Popover so no extra dependency is needed. ARIA pattern: the trigger is a
// combobox, the search box drives aria-activedescendant over a listbox.
export type ComboboxOption = {
  value: string;
  label: string;
  description?: string; // e.g. email, searched too
};

export function filterOptions(options: ReadonlyArray<ComboboxOption>, query: string): ComboboxOption[] {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return [...options];
  return options.filter((o) => `${o.label} ${o.description ?? ""}`.toLocaleLowerCase().includes(q));
}

type ComboboxProps = {
  options: ReadonlyArray<ComboboxOption>;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  // Adds a first row that sets the value to null (e.g. "Unassigned").
  clearLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-invalid"?: true | undefined;
  "aria-describedby"?: string | undefined;
  "aria-required"?: true | undefined;
};

const CLEAR = "__clear__";

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  clearLabel,
  disabled = false,
  className,
  id,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  const rows = useMemo<ComboboxOption[]>(() => {
    const filtered = filterOptions(options, query);
    return clearLabel && query.trim() === "" ? [{ value: CLEAR, label: clearLabel }, ...filtered] : filtered;
  }, [options, query, clearLabel]);

  const selected = options.find((o) => o.value === value);
  const activeId = rows[active] ? `${listId}-${active}` : undefined;

  function reset(next: boolean) {
    setOpen(next);
    setQuery("");
    setActive(0);
  }

  function choose(row: ComboboxOption | undefined) {
    if (!row) return;
    onChange(row.value === CLEAR ? null : row.value);
    reset(false);
  }

  function move(next: number) {
    if (rows.length === 0) return;
    const i = (next + rows.length) % rows.length;
    setActive(i);
    listRef.current?.children[i]?.scrollIntoView?.({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") move(active + 1);
    else if (e.key === "ArrowUp") move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(rows.length - 1);
    else if (e.key === "Enter") choose(rows[active]);
    else return;
    e.preventDefault();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={reset}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          disabled={disabled}
          {...aria}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 text-left text-base transition-colors duration-150 hover:border-foreground-subtle focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle aria-[invalid=true]:border-danger dark:bg-surface-muted",
            selected ? "text-foreground" : "text-foreground-subtle",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronDown aria-hidden className="size-5 shrink-0 text-foreground-muted" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="anim-menu z-50 flex w-[var(--radix-popover-trigger-width)] min-w-56 flex-col overflow-hidden rounded-md border border-border bg-surface shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search aria-hidden className="size-4 shrink-0 text-foreground-subtle" />
            <input
              type="text"
              role="searchbox"
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-10 w-full bg-transparent text-base outline-none placeholder:text-foreground-subtle"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={placeholder} className="max-h-60 overflow-y-auto p-1">
            {rows.map((row, i) => {
              const isSelected = row.value === CLEAR ? value === null : row.value === value;
              return (
                <li
                  key={row.value}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(row)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm",
                    i === active && "bg-surface-muted",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{row.label}</span>
                    {row.description ? <span className="truncate text-xs text-foreground-subtle">{row.description}</span> : null}
                  </span>
                  {isSelected ? <Check aria-hidden className="size-4 shrink-0 text-primary" /> : null}
                </li>
              );
            })}
          </ul>
          {rows.length === 0 ? (
            <p role="status" className="px-3 py-4 text-center text-sm text-foreground-muted">
              {emptyText}
            </p>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
