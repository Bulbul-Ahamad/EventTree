import { CompleteProfileForm } from "@/features/auth/components/complete-profile-form";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { sanitizeNext } from "@/lib/route-guards";

// S19. The middleware sends signed-in users without a phone number here (rule 3a).
export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold">One more thing</h1>
        <p className="text-sm text-foreground-muted">
          Add your phone number so your teammates can reach you. You need it to use EventTree.
        </p>
      </div>
      <CompleteProfileForm next={sanitizeNext(next) ?? undefined} />
      <div className="text-center">
        <LogoutButton />
      </div>
    </>
  );
}
