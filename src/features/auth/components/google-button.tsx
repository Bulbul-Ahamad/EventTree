"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startGoogleOAuth } from "@/features/auth/actions";
import { notify } from "@/lib/toast";

export function GoogleButton({ next }: { next?: string | undefined }) {
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);

  return (
    <Button
      variant="secondary"
      className="w-full"
      loading={pending || redirecting}
      onClick={() =>
        startTransition(async () => {
          const result = await startGoogleOAuth(next ? { next } : {});
          if (result.ok) {
            setRedirecting(true);
            window.location.assign(result.data.url);
          } else {
            notify.error(result.message);
          }
        })
      }
    >
      Continue with Google
    </Button>
  );
}
