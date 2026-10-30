"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resendConfirmation } from "@/features/auth/actions";
import { notify } from "@/lib/toast";

const COOLDOWN_SECONDS = 60;

// 02_AppFlow S03: resend with a 60 s cooldown that shows a countdown.
export function ResendButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  return (
    <Button
      variant="secondary"
      className="w-full"
      loading={pending}
      disabled={left > 0}
      onClick={() =>
        startTransition(async () => {
          const result = await resendConfirmation({ email });
          if (result.ok) {
            notify.success("We sent another email.");
            setLeft(COOLDOWN_SECONDS);
          } else {
            notify.error(result.message);
          }
        })
      }
    >
      {left > 0 ? `Resend email (${left}s)` : "Resend email"}
    </Button>
  );
}
