"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActivePath, type NavItem } from "./nav-items";

// Left nav (>= lg) and bottom nav (< lg) share the same items (02_AppFlow §8).
type Props = { items: NavItem[]; variant: "side" | "bottom" };

export function NavLinks({ items, variant }: Props) {
  const pathname = usePathname();

  return (
    <ul className={cn(variant === "side" ? "flex flex-col gap-1" : "flex h-full items-stretch")}>
      {items.map(({ key, label, href, icon: Icon }) => {
        const active = isActivePath(pathname, href);
        return (
          <li key={key} className={variant === "bottom" ? "flex-1" : undefined}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "transition-colors duration-150",
                variant === "side"
                  ? "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium [&_svg]:size-6"
                  : "flex h-full min-h-11 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium [&_svg]:size-6",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon aria-hidden />
              <span className="truncate">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
