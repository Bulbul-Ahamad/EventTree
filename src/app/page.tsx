import { CheckSquare, ChevronDown, ChevronRight, Folder, TreeDeciduous } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { EventStatusBadge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { createServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

// S01 (02_AppFlow): product name, one-line value prop, Sign up and Log in.
// Signed-in users go straight to the dashboard. The tree card is a static
// illustration (decorative); it shows a Bangla title on purpose.
export default async function LandingPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md text-lg font-bold">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <TreeDeciduous aria-hidden className="size-5" />
          </span>
          <span className="hidden sm:inline">EventTree</span>
          <span className="sr-only sm:hidden">EventTree</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "md:h-10 md:px-4")}>
            Log in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "md:h-10 md:px-4")}>
            Sign up
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 md:px-6 md:py-16 lg:grid-cols-2 lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <p className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              For clubs, organizations and university programs
            </p>
            <h1 className="text-balance text-4xl font-bold">Run every event as a tree of owned tasks.</h1>
            <p className="max-w-xl text-lg text-foreground-muted">
              Split an event into segments and tasks, give each one an owner, and watch progress roll up from the
              smallest task to the whole event.
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Create your first event
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Log in
              </Link>
            </div>
          </div>

          <TreePreview />
        </section>

        <section className="border-t border-border bg-surface">
          <ul className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-3 md:gap-10 md:px-6">
            <Point title="One owner per item">
              Every segment has a head and every task has an assignee. No more vague group-chat assignments.
            </Point>
            <Point title="Verified, not just ticked">
              Assignees submit work, and the head checks it before it counts toward progress.
            </Point>
            <Point title="Leaders see everything below">
              Anyone higher in the tree sees their whole subtree, with progress rolled up automatically.
            </Point>
          </ul>
        </section>
      </main>
    </div>
  );
}

function Point({ title, children }: { title: string; children: string }) {
  return (
    <li className="flex flex-col gap-1">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-foreground-muted">{children}</p>
    </li>
  );
}

function Row({ children, selected = false, indent = false }: { children: React.ReactNode; selected?: boolean; indent?: boolean }) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 rounded-md px-2", indent && "pl-10", selected && "bg-surface-muted")}>
      {children}
    </div>
  );
}

// Static preview of the real tree view. Decorative: hidden from assistive tech.
function TreePreview() {
  return (
    <div aria-hidden className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-md md:p-6">
      <div className="flex items-center justify-between gap-3">
        <p lang="bn" className="text-lg font-semibold">
          টেক ফেস্ট ২০২৬
        </p>
        <EventStatusBadge status="active" />
      </div>
      <ProgressBar value={72} size="header" label="Event progress" />
      <div className="flex flex-col gap-1">
        <Row selected>
          <ChevronDown className="size-5 shrink-0 text-foreground-muted" />
          <Folder className="size-5 shrink-0 text-primary" />
          <span className="flex-1 truncate">Registration</span>
          <ProgressBar value={75} label="Registration" className="w-32" />
        </Row>
        <Row indent>
          <CheckSquare className="size-5 shrink-0 text-foreground-muted" />
          <span className="flex-1 truncate">Payment setup</span>
          <StatusBadge status="verified" />
        </Row>
        <Row>
          <ChevronRight className="size-5 shrink-0 text-foreground-muted" />
          <Folder className="size-5 shrink-0 text-primary" />
          <span className="flex-1 truncate">Venue</span>
          <ProgressBar value={40} label="Venue" className="w-32" />
        </Row>
        <Row>
          <ChevronRight className="size-5 shrink-0 text-foreground-muted" />
          <Folder className="size-5 shrink-0 text-primary" />
          <span className="flex-1 truncate">Publicity</span>
          <ProgressBar value={100} label="Publicity" className="w-32" />
        </Row>
      </div>
    </div>
  );
}
