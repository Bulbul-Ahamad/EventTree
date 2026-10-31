"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PRIORITY_LABELS } from "@/components/ui/badge";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { createNode, reassignNode, updateNode } from "@/features/nodes/actions";
import { createNodeSchema, PRIORITIES, updateNodeSchema } from "@/features/nodes/schemas";
import { fieldErrorsFrom, ok, type ActionResult } from "@/lib/action-result";
import { isoToLocalInput, localInputToIso } from "@/lib/format-date";
import { notify } from "@/lib/toast";
import type { TreeNode } from "@/lib/tree";

// S13 (02_AppFlow): add or edit a segment / task, or only reassign it.
// The action and the database decide what is allowed; the errors they return
// (E_MAX_DEPTH, E_NODE_LIMIT, E_ASSIGNEE_NOT_IN_ORG, E_EVENT_READONLY, ...) show
// their catalogue message here.

export type NodeDialogTarget =
  | { kind: "create"; parent: TreeNode; type: "segment" | "task" }
  | { kind: "edit"; node: TreeNode }
  | { kind: "reassign"; node: TreeNode };

const INCOMPLETE_DATE = "Enter a complete date and time.";
const sameInstant = (a: string | null, b: string | null) =>
  (a === null ? null : new Date(a).getTime()) === (b === null ? null : new Date(b).getTime());

function copy(target: NodeDialogTarget) {
  const word = (t: string) => (t === "segment" ? "segment" : "task");
  if (target.kind === "create") {
    return {
      title: `Add ${word(target.type)}`,
      description: `New ${word(target.type)} under “${target.parent.title}”.`,
      submit: `Add ${word(target.type)}`,
    };
  }
  if (target.kind === "edit") {
    return { title: `Edit ${word(target.node.type)}`, description: `Change “${target.node.title}”.`, submit: "Save" };
  }
  return { title: "Reassign", description: `Choose who is responsible for “${target.node.title}”.`, submit: "Save" };
}

type Props = {
  target: NodeDialogTarget;
  members: ReadonlyArray<ComboboxOption>;
  onClose: () => void;
};

export function NodeFormDialog({ target, members, onClose }: Props) {
  const router = useRouter();
  const form = useFormAction();
  const existing = target.kind === "create" ? null : target.node;
  const nodeType = target.kind === "create" ? target.type : target.node.type;
  const isTask = nodeType === "task";
  const showFields = target.kind !== "reassign";

  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(existing?.assignee_id ?? null);
  const [dueAt, setDueAt] = useState(isoToLocalInput(existing?.due_at ?? null));
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(existing?.priority ?? "medium");
  const [weight, setWeight] = useState(String(existing?.weight ?? 1));
  const { title: heading, description: blurb, submit } = copy(target);

  function finish(message: string) {
    notify.success(message);
    router.refresh();
    onClose();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dueInput = e.currentTarget.elements.namedItem("dueAt");
    const dueIncomplete = dueInput instanceof HTMLInputElement && dueInput.validity.badInput;
    const dueIso = localInputToIso(dueAt);
    const weightNumber = weight.trim() === "" ? Number.NaN : Number(weight);

    function stop(errors: Record<string, string>) {
      form.reset();
      form.setFieldErrors(errors);
    }

    if (target.kind === "reassign") {
      form.run(
        () => reassignNode({ nodeId: target.node.id, assigneeId }),
        () => finish("Assignee updated"),
      );
      return;
    }

    const errors: Record<string, string> = {};
    if (dueIncomplete) errors.dueAt = INCOMPLETE_DATE;
    if (!Number.isFinite(weightNumber)) errors.weight = "Use a number from 1 to 10.";

    if (target.kind === "create") {
      const input = {
        parentId: target.parent.id,
        type: target.type,
        title,
        description,
        assigneeId,
        dueAt: dueIso,
        ...(isTask ? { priority } : {}),
        weight: weightNumber,
      };
      const parsed = createNodeSchema.safeParse(input);
      if (!parsed.success) Object.assign(errors, { ...fieldErrorsFrom(parsed.error), ...errors });
      if (Object.keys(errors).length > 0) return stop(errors);
      form.run(
        () => createNode(input),
        () => finish(target.type === "segment" ? "Segment added" : "Task added"),
      );
      return;
    }

    // Edit: send only what changed, then reassign if the assignee changed.
    const node = target.node;
    const patch: Record<string, unknown> = { nodeId: node.id };
    if (title.trim() !== node.title) patch.title = title;
    if ((description.trim() || null) !== (node.description?.trim() || null)) patch.description = description;
    if (!sameInstant(dueIso, node.due_at)) patch.dueAt = dueIso;
    if (isTask && priority !== node.priority) patch.priority = priority;
    if (Number.isFinite(weightNumber) && weightNumber !== node.weight) patch.weight = weightNumber;
    const fieldsChanged = Object.keys(patch).length > 1;
    const assigneeChanged = assigneeId !== node.assignee_id;

    if (fieldsChanged) {
      const parsed = updateNodeSchema.safeParse(patch);
      if (!parsed.success) Object.assign(errors, { ...fieldErrorsFrom(parsed.error), ...errors });
    }
    if (Object.keys(errors).length > 0) return stop(errors);
    if (!fieldsChanged && !assigneeChanged) return onClose();

    form.run(async (): Promise<ActionResult> => {
      if (fieldsChanged) {
        const saved = await updateNode(patch);
        if (!saved.ok) return saved;
      }
      if (assigneeChanged) {
        const moved = await reassignNode({ nodeId: node.id, assigneeId });
        if (!moved.ok) {
          if (fieldsChanged) router.refresh(); // the other changes were saved
          return moved;
        }
      }
      return ok();
    }, () => finish("Changes saved"));
  }

  const assigneeError =
    form.errorCode === "E_ASSIGNEE_NOT_IN_ORG" ? (form.formError ?? undefined) : form.fieldErrors.assigneeId;
  const formLevelError = form.errorCode === "E_ASSIGNEE_NOT_IN_ORG" ? null : form.formError;

  return (
    <Dialog open onOpenChange={(open) => !open && !form.pending && onClose()}>
      <DialogContent size="form">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{blurb}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {showFields ? (
            <>
              <FormField label="Title" required error={form.fieldErrors.title}>
                {(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
              </FormField>
              <FormField label="Description" error={form.fieldErrors.description}>
                {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
              </FormField>
            </>
          ) : null}
          <FormField label="Assignee" error={assigneeError}>
            {(p) => (
              <Combobox
                {...p}
                options={members}
                value={assigneeId}
                onChange={setAssigneeId}
                placeholder="Unassigned"
                searchPlaceholder="Search members"
                clearLabel="Unassigned"
              />
            )}
          </FormField>
          {showFields ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Due date" error={form.fieldErrors.dueAt}>
                  {(p) => (
                    <Input
                      {...p}
                      type="datetime-local"
                      name="dueAt"
                      value={dueAt}
                      onChange={(e) => setDueAt(e.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Weight (1–10)" error={form.fieldErrors.weight}>
                  {(p) => (
                    <Input
                      {...p}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      step={1}
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  )}
                </FormField>
              </div>
              {isTask ? (
                <FormField label="Priority" error={form.fieldErrors.priority}>
                  {(p) => (
                    <NativeSelect
                      {...p}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as (typeof PRIORITIES)[number])}
                    >
                      {PRIORITIES.map((v) => (
                        <option key={v} value={v}>
                          {PRIORITY_LABELS[v]}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
              ) : null}
            </>
          ) : null}
          <FormError message={formLevelError} />
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={form.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={form.pending}>
              {submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
