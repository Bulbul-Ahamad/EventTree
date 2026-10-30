import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Plain <select> styled with tokens, for short fixed lists. Searchable
// selects come in step 3.01.
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 w-full cursor-pointer appearance-none rounded-md border border-border-strong bg-surface px-3 pr-10 text-base text-foreground transition-colors duration-150 hover:border-foreground-subtle focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle aria-[invalid=true]:border-danger dark:bg-surface-muted",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-foreground-muted"
        aria-hidden
      />
    </div>
  );
}
