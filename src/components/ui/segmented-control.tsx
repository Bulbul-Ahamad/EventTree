"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.13 Tabs / Segmented control. Height 36; the selected item is
// raised (light) or tinted (dark). Roving tabindex, arrows/Home/End move and select.
export type SegmentedOption<T extends string> = { value: T; label: string; count?: number };

type SegmentedControlProps<T extends string> = {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...props
}: SegmentedControlProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function move(to: number) {
    const next = options[(to + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    refs.current[(to + options.length) % options.length]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === "ArrowRight") move(index + 1);
    else if (e.key === "ArrowLeft") move(index - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(options.length - 1);
    else return;
    e.preventDefault();
  }

  return (
    <div
      role="tablist"
      aria-label={props["aria-label"]}
      className={cn("inline-flex h-9 items-center gap-1 rounded-md bg-surface-muted p-1", className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-sm font-medium transition-colors duration-150",
              selected
                ? "bg-surface text-foreground shadow-sm dark:bg-primary-soft"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className="text-xs tabular-nums text-foreground-subtle">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
