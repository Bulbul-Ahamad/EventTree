"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteImpact, type TreeNode } from "@/lib/tree";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Says exactly what a delete removes (PRD US-15 AC1, BR: the subtree and its
// history go with it, there is no undo).
export function deleteDescription(node: TreeNode): string {
  const { segments, tasks, total } = deleteImpact(node);
  const what = node.type === "segment" ? "segment" : "task";
  if (total <= 1) {
    return `“${node.title}” will be deleted for good, together with its activity history. This cannot be undone.`;
  }
  const parts = [segments > 1 ? plural(segments - 1, "segment", "segments") : null, tasks > 0 ? plural(tasks, "task", "tasks") : null];
  const below = parts.filter(Boolean).join(" and ");
  return `Deleting the ${what} “${node.title}” also deletes everything under it: ${below}, ${plural(total - 1, "item", "items")} in all, with their activity history. This cannot be undone.`;
}

export function DeleteNodeDialog({
  node,
  onCancel,
  onConfirm,
}: {
  node: TreeNode | null;
  onCancel: () => void;
  onConfirm: (node: TreeNode) => void;
}) {
  return (
    <ConfirmDialog
      open={node !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={node ? `Delete ${node.type === "segment" ? "segment" : "task"}?` : "Delete?"}
      description={node ? deleteDescription(node) : ""}
      confirmLabel="Delete"
      destructive
      onConfirm={() => node && onConfirm(node)}
    />
  );
}
