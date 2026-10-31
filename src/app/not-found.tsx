import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// S18 (02_AppFlow). Also the answer for anything the user may not see (404 policy).
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center p-4 md:p-6">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that page."
        action={
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
        }
      />
    </main>
  );
}
