import { PageSkeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return <PageSkeleton label="Loading profile" blocks={[200, 120]} />;
}
