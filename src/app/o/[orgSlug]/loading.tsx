import { PageSkeleton } from "@/components/ui/skeleton";

// Fallback for any page of an organization that has no skeleton of its own.
export default function OrgLoading() {
  return <PageSkeleton label="Loading" />;
}
