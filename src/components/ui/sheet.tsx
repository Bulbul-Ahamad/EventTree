"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.7 node detail: right drawer (440 px) from md up, full-screen
// sheet sliding up below md with a rounded top (--radius-xl).

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "anim-sheet fixed inset-0 z-50 flex flex-col overflow-y-auto rounded-t-xl border border-border bg-surface shadow-lg md:left-auto md:w-[440px] md:rounded-none md:border-y-0 md:border-r-0",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex size-10 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-colors duration-150 hover:bg-surface-muted active:bg-border"
        >
          <X aria-hidden className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 border-b border-border p-4 pr-14 md:p-6 md:pr-14", className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-balance text-lg font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-foreground-muted", className)} {...props} />;
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-1 flex-col gap-4 p-4 md:p-6", className)} {...props} />;
}
