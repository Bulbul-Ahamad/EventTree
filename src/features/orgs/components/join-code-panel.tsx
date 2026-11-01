"use client";

import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rotateJoinCode } from "@/features/orgs/actions";
import { notify } from "@/lib/toast";

// S15 admin panel: the join code is masked until shown, Copy always copies the
// real code, Rotate asks first because the old code stops working at once.
export function JoinCodePanel({ orgId, joinCode }: { orgId: string; joinCode: string }) {
  const [code, setCode] = useState(joinCode);
  const [shown, setShown] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      notify.success("Join code copied");
    } catch {
      notify.error("Couldn't copy. Show the code and copy it by hand.");
    }
  }

  function rotate() {
    startTransition(async () => {
      const result = await rotateJoinCode({ orgId });
      setConfirming(false);
      if (result.ok) {
        setCode(result.data.joinCode);
        notify.success("New join code created");
      } else {
        notify.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join code</CardTitle>
        <CardDescription>Share this code so people can join the organization as members.</CardDescription>
      </CardHeader>
      <div className="flex flex-wrap items-center gap-2">
        <code
          data-testid="join-code"
          className="min-w-0 rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-base tracking-wider"
        >
          {shown ? (
            code
          ) : (
            <>
              <span aria-hidden>{"•".repeat(code.length)}</span>
              <span className="sr-only">Hidden</span>
            </>
          )}
        </code>
        <Button
          variant="ghost"
          size="icon"
          aria-label={shown ? "Hide join code" : "Show join code"}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
        >
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        <Button variant="secondary" onClick={copy}>
          <Copy aria-hidden className="size-4" />
          Copy
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          <RefreshCw aria-hidden className="size-4" />
          Rotate
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Create a new join code?"
        description="The current code stops working immediately. People who are already members stay in."
        confirmLabel="Rotate code"
        destructive
        loading={pending}
        onConfirm={rotate}
      />
    </Card>
  );
}
