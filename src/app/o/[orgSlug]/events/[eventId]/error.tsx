"use client";

import { RouteError } from "@/components/ui/route-error";

// S11: a tree that fails to load shows the boundary with Try again (02_AppFlow).
export default function EventError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} />;
}
