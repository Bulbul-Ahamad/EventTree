import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Label({
  className,
  required,
  children,
  ...props
}: ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden className="ml-1 text-danger">
          *
        </span>
      ) : null}
    </label>
  );
}
