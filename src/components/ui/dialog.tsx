"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.7. Radix gives the focus trap, Esc to close and focus return.
// Max width 480, forms 560. Footer: secondary left of primary; on mobile
// stacked full width with the primary on top.

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("anim-overlay fixed inset-0 z-50 bg-[var(--backdrop)]", className)}
      {...props}
    />
  );
}

type DialogContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  size?: "md" | "form";
  hideClose?: boolean;
};

export function DialogContent({ className, children, size = "md", hideClose = false, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "anim-pop fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg md:p-6",
          size === "form" ? "max-w-[560px]" : "max-w-[480px]",
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex size-10 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-colors duration-150 hover:bg-surface-muted active:bg-border"
          >
            <X aria-hidden className="size-5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pr-10", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-balance text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-foreground-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 md:flex-row md:justify-end", className)} {...props} />;
}
