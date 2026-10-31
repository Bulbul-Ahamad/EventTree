import { TreeSkeleton } from "@/components/ui/skeleton";

export default function EventLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <TreeSkeleton className="rounded-lg border border-border bg-surface p-2" />
    </div>
  );
}
