import { PageSkeleton } from "@/components/ui/skeleton";

export default function OnboardingLoading() {
  return <PageSkeleton label="Loading" blocks={[220, 160]} />;
}
