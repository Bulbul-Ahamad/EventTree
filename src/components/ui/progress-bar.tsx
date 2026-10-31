import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.5 and §2.4. Fill is --primary until 100 %, then --success.
// Heights: 8 px in the tree, 12 px in the event header.

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

type ProgressBarProps = Omit<ComponentProps<"div">, "children"> & {
  value: number;
  size?: "tree" | "header";
  showLabel?: boolean;
  label: string; // accessible name, e.g. "Venue progress"
};

export function ProgressBar({ value, size = "tree", showLabel = true, label, className, ...props }: ProgressBarProps) {
  const pct = clampPercent(value);
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={cn("w-full overflow-hidden rounded-full bg-progress-track", size === "header" ? "h-3" : "h-2")}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-150", pct === 100 ? "bg-success" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span aria-hidden className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground-muted">
          {pct}%
        </span>
      ) : null}
    </div>
  );
}
