"use client";

import { MoreVertical, Pencil, Plus, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canCreateChild, canEditNode, canReassignNode, type EventContext, type NodeContext } from "@/lib/permissions";
import type { TreeNode } from "@/lib/tree";
import type { NodeDialogTarget } from "./node-form-dialog";

// Row ⋮ menu (02_AppFlow S11). Items appear only when the permission mirror
// allows them; the database still has the final say. Delete and status
// actions arrive in 3.10 and 3.11.
type Props = {
  node: TreeNode;
  ctx: EventContext;
  nodeCtx: NodeContext;
  onOpenDialog: (target: NodeDialogTarget) => void;
};

export function NodeActions({ node, ctx, nodeCtx, onOpenDialog }: Props) {
  const canAdd = canCreateChild(ctx, nodeCtx);
  const canEdit = node.type !== "event" && canEditNode(ctx, nodeCtx);
  const canReassign = canReassignNode(ctx, nodeCtx);
  if (!canAdd && !canEdit && !canReassign) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${node.title}`}>
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {canAdd ? (
          <>
            <DropdownMenuItem onSelect={() => onOpenDialog({ kind: "create", parent: node, type: "segment" })}>
              <Plus aria-hidden /> Add segment
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenDialog({ kind: "create", parent: node, type: "task" })}>
              <Plus aria-hidden /> Add task
            </DropdownMenuItem>
          </>
        ) : null}
        {canAdd && (canEdit || canReassign) ? <DropdownMenuSeparator /> : null}
        {canEdit ? (
          <DropdownMenuItem onSelect={() => onOpenDialog({ kind: "edit", node })}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
        ) : null}
        {canReassign ? (
          <DropdownMenuItem onSelect={() => onOpenDialog({ kind: "reassign", node })}>
            <UserRoundCog aria-hidden /> Reassign
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
