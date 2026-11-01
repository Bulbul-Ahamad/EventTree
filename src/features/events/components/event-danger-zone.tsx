"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { deleteEvent } from "@/features/events/actions";
import { notify } from "@/lib/toast";

// S14 danger zone: delete is enabled only in draft or archived, and asks for the
// event title to be typed first. The database enforces the same rule.
export function EventDangerZone({
  eventId,
  title,
  canDelete,
  eventsHref,
}: {
  eventId: string;
  title: string;
  canDelete: boolean;
  eventsHref: string;
}) {
  const router = useRouter();
  const form = useFormAction();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === title.trim();

  function close() {
    if (form.pending) return;
    setOpen(false);
    setTyped("");
    form.reset();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!matches) return;
    form.run(
      () => deleteEvent({ eventId }),
      () => {
        notify.success("Event deleted");
        router.push(eventsHref);
      },
    );
  }

  return (
    <Card className="border-danger">
      <CardHeader>
        <CardTitle className="text-danger">Danger zone</CardTitle>
        <CardDescription>
          {canDelete
            ? "Deleting the event removes every segment, task and all of its history for good. This cannot be undone."
            : "An event can be deleted only while it is a draft or archived."}
        </CardDescription>
      </CardHeader>
      <div>
        <Button variant="destructive" disabled={!canDelete} onClick={() => setOpen(true)}>
          Delete event
        </Button>
      </div>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Delete this event?</DialogTitle>
              <DialogDescription>
                This permanently deletes “{title}”, all of its segments and tasks, and its activity history.
              </DialogDescription>
            </DialogHeader>
            <FormField label="Type the event title to confirm" hint={title}>
              {(p) => <Input {...p} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />}
            </FormField>
            <FormError message={form.formError} />
            <DialogFooter>
              <Button type="button" variant="secondary" disabled={form.pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!matches} loading={form.pending}>
                Delete event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
