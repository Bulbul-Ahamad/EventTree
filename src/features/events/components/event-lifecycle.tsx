"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { setEventStatus } from "@/features/events/actions";
import { lifecycleSteps, type LifecycleStep } from "@/features/events/lifecycle";
import { notify } from "@/lib/toast";
import type { EventStatus } from "@/lib/permissions";

// Owner-only lifecycle buttons (02_AppFlow S11 and §6). Each one asks for
// confirmation; draft -> active and active -> completed add a non-blocking warning.
type Props = {
  eventId: string;
  status: EventStatus;
  progress: number;
  unassignedCount: number;
  settingsHref: string;
};

export function EventLifecycle({ eventId, status, progress, unassignedCount, settingsHref }: Props) {
  const router = useRouter();
  const form = useFormAction();
  const [pending, setPending] = useState<LifecycleStep | null>(null);
  const steps = lifecycleSteps(status, { progress, unassignedCount });

  function confirm(step: LifecycleStep) {
    form.run(
      () => setEventStatus({ eventId, to: step.to }),
      () => {
        notify.success(step.toast);
        setPending(null);
        router.refresh();
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <Button
          key={step.to}
          variant={i === 0 ? "primary" : "secondary"}
          onClick={() => {
            form.reset();
            setPending(step);
          }}
        >
          {step.label}
        </Button>
      ))}
      <Link href={settingsHref} className={buttonVariants({ variant: "ghost" })}>
        <Settings aria-hidden className="size-4" />
        Settings
      </Link>
      {pending ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          title={pending.title}
          description={[pending.description, pending.warning, form.formError].filter(Boolean).join(" ")}
          confirmLabel={pending.label}
          loading={form.pending}
          onConfirm={() => confirm(pending)}
        />
      ) : null}
    </div>
  );
}
