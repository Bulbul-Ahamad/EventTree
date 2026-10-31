"use client";

import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.8. Items are 40 px high, destructive items use --danger.
// Per the spec, disabled items are hidden unless they explain a rule (then
// they stay disabled and are wrapped in a Tooltip by the caller).

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "end",
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "anim-menu z-50 min-w-48 overflow-hidden rounded-md border border-border bg-surface p-1 shadow-md",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

type ItemProps = ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean };

export function DropdownMenuItem({ className, destructive = false, ...props }: ItemProps) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex h-10 cursor-pointer select-none items-center gap-2 rounded-sm px-3 text-sm outline-none transition-colors duration-150 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-surface-muted [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-danger" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-3 py-2 text-xs font-medium text-foreground-subtle", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}
