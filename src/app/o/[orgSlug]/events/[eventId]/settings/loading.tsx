import { PageSkeleton } from "@/components/ui/skeleton";

export default function EventSettingsLoading() {
  return <PageSkeleton label="Loading event settings" blocks={[384, 144]} />;
}
