"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/input";
import type { Transition } from "@/lib/status";

// Status buttons in the detail panel (02_AppFlow S12, §5). Send back and Reopen
// ask for a comment first, in place. Render with key={status} so the form resets
// once the status has changed.
type Props = {
  transitions: Transition[];
  pending: boolean;
  error: string | null;
  onRun: (t: Transition, comment?: string) => void;
};

// Forward steps are the main action; going back is secondary.
const SECONDARY = new Set(["T2", "T5", "T7"]);

export function StatusControls({ transitions, pending, error, onRun }: Props) {
  const [commenting, setCommenting] = useState<Transition | null>(null);
  const [comment, setComment] = useState("");
  if (transitions.length === 0) return null;

  function confirm(e: FormEvent) {
    e.preventDefault();
    if (commenting) onRun(commenting, comment);
  }

  return (
    <section aria-labelledby="panel-actions" className="flex flex-col gap-3">
      <h3 id="panel-actions" className="text-sm font-semibold">
        Actions
      </h3>
      <div className="flex flex-wrap gap-2">
        {transitions.map((t) => (
          <Button
            key={`${t.id}-${t.from}`}
            variant={SECONDARY.has(t.id) ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => (t.commentRequired ? setCommenting(t) : onRun(t))}
          >
            {t.label}
          </Button>
        ))}
      </div>
      {commenting ? (
        <form onSubmit={confirm} noValidate className="flex flex-col gap-3 rounded-md border border-border p-3">
          <FormField label={`Why? (${commenting.label})`} required>
            {(p) => <Textarea {...p} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />}
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setCommenting(null);
                setComment("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {commenting.label}
            </Button>
          </div>
        </form>
      ) : null}
      <FormError message={error} />
    </section>
  );
}
