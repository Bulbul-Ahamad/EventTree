import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.2. 16 px text avoids iOS zoom. Error state via aria-invalid.
const field =
  "w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-foreground-subtle transition-colors duration-150 hover:border-foreground-subtle focus-visible:border-ring disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle aria-[invalid=true]:border-danger dark:bg-surface-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(field, "min-h-24 py-2", className)} {...props} />
  );
}
