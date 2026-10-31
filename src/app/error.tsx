"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// S18 error boundary. The error text is never shown (it can contain internals);
// the digest is logged so the server log entry can be found.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error", error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center p-4 md:p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong."
        description="Please try again. If it keeps happening, come back in a few minutes."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset}>Try again</Button>
            <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
              Go to dashboard
            </Link>
          </div>
        }
      />
    </main>
  );
}
