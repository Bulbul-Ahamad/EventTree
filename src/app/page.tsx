import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// S01 (02_AppFlow): product name, one-line value prop, Sign up and Log in.
// Signed-in users go straight to the dashboard.
export default async function LandingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-8 p-4 text-center md:p-6">
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold text-primary">EventTree</p>
        <h1 className="text-balance text-4xl font-bold">Plan events as trees.</h1>
        <p className="max-w-xl text-balance text-lg text-foreground-muted">
          Break an event into segments and tasks, give each one an owner, and watch verified progress roll up to
          the top.
        </p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "sm:min-w-40")}>
          Sign up
        </Link>
        <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "sm:min-w-40")}>
          Log in
        </Link>
      </div>
    </main>
  );
}
