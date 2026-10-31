import { CalendarDays, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";

// Primary navigation (02_AppFlow §8): Dashboard, Events, Members, Org settings
// (admins only). Pure functions so the rules are unit tested.

export type NavItem = { key: "dashboard" | "events" | "members" | "settings"; label: string; href: string; icon: LucideIcon };

export function navItemsFor(orgSlug: string | null, isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [{ key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }];
  if (orgSlug) {
    const base = `/o/${encodeURIComponent(orgSlug)}`;
    items.push(
      { key: "events", label: "Events", href: `${base}/events`, icon: CalendarDays },
      { key: "members", label: "Members", href: `${base}/members`, icon: Users },
    );
    if (isAdmin) items.push({ key: "settings", label: "Org settings", href: `${base}/settings`, icon: Settings });
  }
  return items;
}

// An item is active on its own path and below it. "Events" stays active on an
// event page; "Org settings" is not active on "/o/x/settings-foo".
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Where "Events"/"Members" should point when no organization is open (dashboard,
// profile): the last one used if it is still one of mine, else the first.
export function pickOrgSlug(slugs: ReadonlyArray<string>, lastSlug: string | null | undefined): string | null {
  if (lastSlug && slugs.includes(lastSlug)) return lastSlug;
  return slugs[0] ?? null;
}

export const LAST_ORG_COOKIE = "et_last_org";
