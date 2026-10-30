"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { notify } from "@/lib/toast";

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      loading={pending}
      onClick={() =>
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
      {pending ? null : <LogOut aria-hidden />}
      Log out
    </Button>
  );
}
