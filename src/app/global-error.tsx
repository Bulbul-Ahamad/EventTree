"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import "./globals.css";

// Last-resort boundary: replaces the root layout, so it brings its own <html>
// and <body>. No theme provider is available here; the OS preference applies.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error", error.digest ?? "");
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background font-sans text-foreground antialiased">
        <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center p-4 md:p-6">
          <EmptyState
            icon={TriangleAlert}
            title="Something went wrong."
            description="Please try again. If it keeps happening, come back in a few minutes."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={reset}>Try again</Button>
                {/* A plain link: the router may be what failed. */}
                <a href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
                  Go to dashboard
                </a>
              </div>
            }
          />
        </main>
      </body>
    </html>
  );
}
