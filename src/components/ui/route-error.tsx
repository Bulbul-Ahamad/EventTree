"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

// Error boundary body (02_AppFlow S18): "Something went wrong." with Try again
// and Go to dashboard. The error text is never shown (it can contain internals);
// the digest is logged so the server log entry can be found. Try again asks the
// server for fresh data first, because a failed server read would otherwise
// just fail again from the cached result.
export function RouteError({
  error,
  reset,
  fullPage = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  fullPage?: boolean; // true outside the app shell (no sidebar around it)
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    console.error("Route error", error.digest ?? "");
  }, [error]);

  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div
      role="alert"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col justify-center p-4 md:p-6",
        fullPage ? "min-h-screen" : "min-h-[50vh]",
      )}
    >
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong."
        description="Please try again. If it keeps happening, come back in a few minutes."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={retry} loading={pending}>
              Try again
            </Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
              Go to dashboard
            </Link>
          </div>
        }
      />
    </div>
  );
}
