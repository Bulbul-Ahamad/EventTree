import { PageSkeleton } from "@/components/ui/skeleton";

export default function OrgSettingsLoading() {
  return <PageSkeleton label="Loading organization settings" blocks={[260]} />;
}
