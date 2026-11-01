"use client";

import { RouteError } from "@/components/ui/route-error";

// Inside the app shell: only the page area is replaced, the navigation stays.
export default function SegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} />;
}
