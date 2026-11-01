import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.11. Pass a radius class that matches the target element.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton h-4 rounded-md", className)} {...props} />;
}

// Tree skeleton: 8 rows with varying indent (§8.11). Indent steps are fixed classes.
const INDENTS = ["pl-0", "pl-4", "pl-8", "pl-8", "pl-4", "pl-8", "pl-12", "pl-0"] as const;

export function TreeSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex flex-col", className)}>
      {INDENTS.map((indent, i) => (
        <div key={i} className={cn("flex h-11 items-center gap-3", indent)}>
          <Skeleton className="size-5 rounded-sm" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="hidden h-4 w-12 md:block" />
        </div>
      ))}
    </div>
  );
}

// A page with a title and a few cards or fields (forms, settings, members).
// Same outer spacing as the real pages so nothing jumps when the content arrives.
export function PageSkeleton({
  label,
  blocks = [96, 160],
  className,
}: {
  label: string;
  blocks?: ReadonlyArray<number>; // heights in px of the blocks under the title
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6", className)}
    >
      <Skeleton className="h-8 w-48" />
      {blocks.map((h, i) => (
        <Skeleton key={i} className="w-full rounded-lg" style={{ height: h }} />
      ))}
    </div>
  );
}
