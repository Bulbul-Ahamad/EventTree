"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import type { Transition } from "@/lib/status";

// Send back / Reopen chosen from the row menu: the comment is required.
type Props = {
  taskTitle: string;
  transition: Transition;
  pending: boolean;
  error: string | null;
  onConfirm: (comment: string) => void;
  onClose: () => void;
};

export function TransitionCommentDialog({ taskTitle, transition, pending, error, onConfirm, onClose }: Props) {
  const [comment, setComment] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    onConfirm(comment);
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transition.label}</DialogTitle>
          <DialogDescription>Explain why, for “{taskTitle}”. The comment is added to its activity.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormField label="Comment" required>
            {(p) => <Textarea {...p} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />}
          </FormField>
          <FormError message={error} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {transition.label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
