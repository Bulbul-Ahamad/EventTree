"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LAST_ORG_COOKIE } from "./nav-items";

type Org = { id: string; name: string; slug: string };

// 02_AppFlow S08: the top bar lists my organizations; choosing one opens its
// events. Also remembers the open organization in a cookie, so org-less pages
// (dashboard, profile) can still point "Events" at the last one used.
export function OrgSwitcher({ orgs, currentSlug }: { orgs: Org[]; currentSlug: string | null }) {
  const router = useRouter();
  const current = orgs.find((o) => o.slug === currentSlug) ?? null;

  useEffect(() => {
    if (!currentSlug) return;
    document.cookie = `${LAST_ORG_COOKIE}=${encodeURIComponent(currentSlug)}; path=/; max-age=31536000; samesite=lax`;
  }, [currentSlug]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label={`Organization: ${current?.name ?? "none selected"}`} className="max-w-[10rem] md:max-w-[16rem]">
          <span className="truncate">{current?.name ?? "Organizations"}</span>
          <ChevronsUpDown aria-hidden className="!size-4 text-foreground-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => router.push(`/o/${encodeURIComponent(o.slug)}/events`)}>
            <span className="flex-1 truncate">{o.name}</span>
            {o.slug === currentSlug ? <Check aria-hidden className="text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        {orgs.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus aria-hidden /> Join or create organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
