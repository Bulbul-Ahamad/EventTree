import { Skeleton } from "@/components/ui/skeleton";

// Shown inside the auth card while a login, signup or reset page loads.
export default function AuthLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}
