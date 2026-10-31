"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { signOut } from "@/features/auth/actions";
import { notify } from "@/lib/toast";

type Props = { user: { id: string; name: string; email: string } };

export function UserMenu({ user }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <Tooltip content="Account">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-surface-muted"
          >
            <Avatar id={user.id} name={user.name} />
          </button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="min-w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
          <span className="truncate font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <UserRound aria-hidden /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={pending}
          onSelect={() =>
            startTransition(async () => {
              const result = await signOut();
              if (!result.ok) {
                notify.error(result.message);
                return;
              }
              router.push("/login");
              router.refresh();
            })
          }
        >
          <LogOut aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
