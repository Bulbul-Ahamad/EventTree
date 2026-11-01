"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.7. Radix gives the focus trap and Esc to close. Max width 480,
// forms 560. Footer: secondary left of primary; on mobile stacked full width
// with the primary on top.
//
// Focus return: Radix only returns focus to a <DialogTrigger>. Our dialogs are
// controlled and opened from buttons and menu items, so there is no trigger and
// focus would fall to <body>. DialogContent therefore remembers what had focus
// when it opened and gives focus back when it closes (see returnTargetFor).

// The element last pressed with a pointer. Safari and Firefox on macOS do not focus
// a button when it is clicked, so document.activeElement alone would be <body>.
let lastPointerTarget: Element | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointerTarget = e.target instanceof Element ? e.target.closest("button, a, [role='menuitem'], [tabindex]") : null;
    },
    true,
  );
}

// Where focus should go when a dialog closes. For an item picked from a menu that
// is the menu's own trigger (Radix labels the menu with the trigger's id).
export function returnTargetFor(active: Element | null, pointer: Element | null): HTMLElement | null {
  let el: Element | null = active && active !== document.body ? active : pointer;
  const menu = el?.closest("[role='menu']");
  if (menu) {
    const triggerId = menu.getAttribute("aria-labelledby");
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    if (trigger) el = trigger;
  }
  return el instanceof HTMLElement ? el : null;
}

// Root with a safety net for focus return. Remembering the opener here, in a layout
// effect of the commit that opens the dialog, does not depend on Radix's auto-focus
// events: at that moment focus has not moved into the dialog yet. When the dialog is
// gone and focus has fallen to <body>, it goes back to the opener.
export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  const { open } = props;
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) {
      opener.current = returnTargetFor(document.activeElement, lastPointerTarget);
      return;
    }
    const target = opener.current;
    opener.current = null;
    if (!target) return;
    const timer = setTimeout(() => {
      const active = document.activeElement;
      if (target.isConnected && (!active || active === document.body)) target.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open]);
  return <DialogPrimitive.Root {...props} />;
}
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

export function DialogContent({
  className,
  children,
  size = "md",
  hideClose = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: DialogContentProps) {
  const returnTo = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "anim-pop fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg md:p-6",
          size === "form" ? "max-w-[560px]" : "max-w-[480px]",
          className,
        )}
        onOpenAutoFocus={(e) => {
          returnTo.current = returnTargetFor(document.activeElement, lastPointerTarget);
          onOpenAutoFocus?.(e);
        }}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e);
          const target = returnTo.current;
          returnTo.current = null;
          if (!e.defaultPrevented && target?.isConnected) {
            e.preventDefault(); // skip Radix's trigger-only default
            target.focus();
          }
        }}
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
  return <DialogPrimitive.Title className={cn("text-balance break-words text-lg font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("break-words text-sm text-foreground-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 md:flex-row md:justify-end", className)} {...props} />;
}
