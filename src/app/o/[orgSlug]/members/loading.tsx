import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div role="status" aria-label="Loading members" className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-8 w-40" />
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border p-3 last:border-b-0 md:p-4">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
