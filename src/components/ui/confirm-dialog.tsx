"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Confirmation for destructive or irreversible actions (delete, complete event).
// Controlled: the caller owns `open`. While `loading` the dialog cannot be
// dismissed, so a pending request is never orphaned.
type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (loading && !next ? undefined : onOpenChange(next))}>
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => loading && e.preventDefault()}
        onInteractOutside={(e) => loading && e.preventDefault()}
      >
        <DialogHeader className="pr-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={loading}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button variant={destructive ? "destructive" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
