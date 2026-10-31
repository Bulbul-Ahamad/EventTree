"use client";

import { useRouter } from "next/navigation";
import { useCallback, useOptimistic, useState, useTransition } from "react";
import { transitionTask } from "@/features/updates/actions";
import { errorMessage } from "@/lib/errors";
import type { EventContext, NodeContext, TaskStatus } from "@/lib/permissions";
import { allowedTransitions, transitionError, type Transition, type TransitionId } from "@/lib/status";
import { notify } from "@/lib/toast";
import type { TreeNode } from "@/lib/tree";

const DONE: Record<TransitionId, string> = {
  T1: "Task started",
  T2: "Moved back to To do",
  T3: "Submitted for review",
  T4: "Task verified",
  T5: "Sent back",
  T6: "Task verified",
  T7: "Task reopened",
};

const NO_IDS: ReadonlySet<string> = new Set();

type Options = {
  ctx: EventContext;
  nodeContexts: ReadonlyMap<string, NodeContext>;
  // Optimistic update: show the new status at once; React puts the old one back
  // when the request ends in an error.
  apply: (change: { id: string; status: TaskStatus }) => void;
};

type RunOptions = {
  comment?: string;
  inline?: boolean; // the caller shows the error itself (panel, comment dialog); otherwise a toast
  onSuccess?: () => void;
};

// Status changes (02_AppFlow §5, S11/S12). The UI pre-checks with lib/status.ts,
// then calls the action; the database has the final say. E_STALE_STATE means the
// row changed under us: say so and refetch.
export function useTaskTransitions({ ctx, nodeContexts, apply }: Options) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // "Saving" is also optimistic: state set inside a transition only shows once the
  // transition ends, which is too late for a spinner. This one reverts by itself.
  const [pendingIds, addPending] = useOptimistic<ReadonlySet<string>, string>(NO_IDS, (current, id) =>
    new Set(current).add(id),
  );
  const [error, setError] = useState<{ nodeId: string; message: string } | null>(null);

  const transitionsFor = useCallback(
    (node: TreeNode): Transition[] => {
      const nodeCtx = nodeContexts.get(node.id);
      return nodeCtx && node.status ? allowedTransitions(ctx, nodeCtx, node.status) : [];
    },
    [ctx, nodeContexts],
  );

  const run = useCallback(
    (node: TreeNode, t: Transition, opts: RunOptions = {}) => {
      const nodeCtx = nodeContexts.get(node.id);
      if (!nodeCtx) return;
      const fail = (message: string) => {
        if (opts.inline) setError({ nodeId: node.id, message });
        else notify.error(message);
      };

      const pre = transitionError(ctx, nodeCtx, t.from, t.to, opts.comment);
      if (pre) return fail(errorMessage(pre));
      setError(null);

      startTransition(async () => {
        apply({ id: node.id, status: t.to });
        addPending(node.id);
        const comment = opts.comment?.trim();
        const result = await transitionTask({ nodeId: node.id, from: t.from, to: t.to, comment: comment || null });
        if (result.ok) {
          notify.success(DONE[t.id]);
          router.refresh();
          opts.onSuccess?.();
          return;
        }
        if (result.code === "E_STALE_STATE") {
          notify.error(result.message);
          router.refresh();
          return;
        }
        fail(result.message);
      });
    },
    [ctx, nodeContexts, apply, addPending, router],
  );

  const clearError = useCallback(() => setError(null), []);
  return { run, transitionsFor, pendingIds, error, clearError };
}
