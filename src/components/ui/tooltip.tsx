"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Short hint on hover and keyboard focus. Never the only place a fact appears:
// touch devices do not show tooltips, so keep essential text visible elsewhere.

export const TooltipProvider = TooltipPrimitive.Provider;

type TooltipProps = {
  content: ReactNode;
  children: ReactNode; // one focusable element
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
};

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "anim-menu z-50 max-w-64 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md",
            className,
          )}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
