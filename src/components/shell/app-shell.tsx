import { TreeDeciduous } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavLinks } from "./nav-links";
import { navItemsFor } from "./nav-items";
import { OrgSwitcher } from "./org-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";
import type { ShellData } from "./shell-data";

// App shell (02_AppFlow §1, 03_UI_Spec §3): top bar 56 px with logo, org switcher,
// theme toggle and user menu; left nav 240 px from lg, bottom nav below lg.
// Landmarks: header, nav, main. The skip link is the first focusable element.
export function AppShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const items = navItemsFor(data.navOrg?.slug ?? null, data.navOrg?.role === "admin");

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-surface px-4 md:gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 rounded-md text-lg font-bold text-primary">
          <TreeDeciduous aria-hidden className="size-6" />
          <span className="hidden sm:inline">EventTree</span>
          <span className="sr-only sm:hidden">EventTree</span>
        </Link>
        <OrgSwitcher orgs={data.orgs} currentSlug={data.currentOrg?.slug ?? null} />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={data.user} />
        </div>
      </header>

      <div className="flex">
        <nav
          aria-label="Primary"
          className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-3 lg:block"
        >
          <NavLinks items={items} variant="side" />
        </nav>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-20 outline-none lg:pb-0">
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 h-16 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLinks items={items} variant="bottom" />
      </nav>
    </TooltipProvider>
  );
}
