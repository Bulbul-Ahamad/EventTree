import Link from "next/link";
import type { ReactNode } from "react";

// Auth pages: centered card, no app shell (02_AppFlow §1).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-4 md:p-6">
      <Link href="/" className="text-center text-2xl font-bold text-primary">
        EventTree
      </Link>
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-6">
        {children}
      </div>
    </main>
  );
}
