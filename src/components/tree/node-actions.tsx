"use client";

import { Check, MoreVertical, Pencil, Plus, UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canCreateChild, canEditNode, canReassignNode, type EventContext, type NodeContext } from "@/lib/permissions";
import { Tooltip } from "@/components/ui/tooltip";
import type { Transition } from "@/lib/status";
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
  // Status changes the viewer may make on this task right now (lib/status.ts).
  transitions: Transition[];
  onTransition: (t: Transition) => void;
};

export function NodeActions({ node, ctx, nodeCtx, onOpenDialog, transitions, onTransition }: Props) {
  const canAdd = canCreateChild(ctx, nodeCtx);
  const canEdit = node.type !== "event" && canEditNode(ctx, nodeCtx);
  const canReassign = canReassignNode(ctx, nodeCtx);
  const verify = transitions.find((t) => t.to === "verified");
  const hasMenu = canAdd || canEdit || canReassign || transitions.length > 0;
  if (!hasMenu) return null;

  return (
    <span className="flex items-center">
      {verify ? (
        <Tooltip content="Mark verified">
          <Button variant="ghost" size="icon" aria-label={`Mark ${node.title} verified`} onClick={() => onTransition(verify)}>
            <Check aria-hidden className="text-success" />
          </Button>
        </Tooltip>
      ) : null}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${node.title}`}>
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {transitions.map((t) => (
          <DropdownMenuItem key={`${t.id}-${t.from}`} onSelect={() => onTransition(t)}>
            {t.label}
          </DropdownMenuItem>
        ))}
        {transitions.length > 0 && (canAdd || canEdit || canReassign) ? <DropdownMenuSeparator /> : null}
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
    </span>
  );
}
