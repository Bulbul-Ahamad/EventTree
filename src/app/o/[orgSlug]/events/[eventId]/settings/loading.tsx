import { Skeleton } from "@/components/ui/skeleton";

export default function EventSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-96 w-full rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  );
}
