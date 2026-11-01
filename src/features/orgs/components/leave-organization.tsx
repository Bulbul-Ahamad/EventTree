"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { leaveOrganization } from "@/features/orgs/actions";
import { notify } from "@/lib/toast";

// S15: any member may leave (the last admin and an event owner cannot, the
// database says why). Afterwards the app decides where to go next.
export function LeaveOrganization({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      const result = await leaveOrganization({ orgId });
      if (result.ok) {
        notify.success(`You left ${orgName}`);
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setOpen(false);
      notify.error(result.message);
    });
  }

  return (
    <>
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Leave organization
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Leave ${orgName}?`}
        description="You lose access to its events and are taken off every segment and task assigned to you. You can join again with the join code."
        confirmLabel="Leave"
        destructive
        loading={pending}
        onConfirm={leave}
      />
    </>
  );
}
