import { PageSkeleton } from "@/components/ui/skeleton";

export default function NewEventLoading() {
  return <PageSkeleton label="Loading" blocks={[420]} />;
}
