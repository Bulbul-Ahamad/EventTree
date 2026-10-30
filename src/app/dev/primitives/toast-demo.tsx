"use client";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/toast";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => notify.success("Event created as draft")}>Success</Button>
      <Button variant="secondary" onClick={() => notify.info("Session refreshed")}>
        Info
      </Button>
      <Button
        variant="destructive"
        onClick={() => notify.error("This task was just updated by someone else.")}
      >
        Error
      </Button>
    </div>
  );
}
