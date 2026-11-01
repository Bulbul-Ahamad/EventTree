"use client";

import { RouteError } from "@/components/ui/route-error";

// S18 error boundary for routes outside the app shell (landing, auth, onboarding).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <RouteError error={error} reset={reset} fullPage />
    </main>
  );
}
