"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { updateEventSettings } from "@/features/events/actions";
import type { EventDetail } from "@/features/events/queries";
import { updateEventSettingsSchema } from "@/features/events/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { isoToLocalInput, localInputToIso } from "@/lib/format-date";
import { notify } from "@/lib/toast";

const INCOMPLETE_DATE = "Enter a complete date and time.";

const REVIEW_OPTIONS = [
  { value: "assignee_submits", label: "Assignees submit, managers verify (recommended)" },
  { value: "head_only", label: "Managers tick tasks directly" },
] as const;

// S14 (02_AppFlow): edit title, description, dates, location and review mode.
// Same Zod schema as the action. While the event is completed or archived the
// database refuses edits (E_EVENT_READONLY), so the form is shown read-only.
export function EventSettingsForm({ event, readOnly }: { event: EventDetail; readOnly: boolean }) {
  const router = useRouter();
  const form = useFormAction();
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(event.endsAt));
  const [location, setLocation] = useState(event.location ?? "");
  const [reviewMode, setReviewMode] = useState<(typeof REVIEW_OPTIONS)[number]["value"]>(event.reviewMode);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    // A half-filled datetime-local never fires onChange (its value stays ""), so read it now.
    const incomplete = (name: string) => {
      const el = e.currentTarget.elements.namedItem(name);
      return el instanceof HTMLInputElement && el.validity.badInput;
    };
    const startsIncomplete = incomplete("startsAt");
    const endsIncomplete = incomplete("endsAt");
    const input = {
      eventId: event.id,
      title,
      description,
      startsAt: localInputToIso(startsAt),
      endsAt: localInputToIso(endsAt),
      location,
      reviewMode,
    };
    const parsed = updateEventSettingsSchema.safeParse(input);
    const errors = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    if (startsIncomplete) errors.startsAt = INCOMPLETE_DATE;
    if (endsIncomplete) errors.endsAt = INCOMPLETE_DATE;
    if (!parsed.success || startsIncomplete || endsIncomplete) {
      form.reset();
      form.setFieldErrors(errors);
      return;
    }
    form.run(
      () => updateEventSettings(input),
      () => {
        notify.success("Event settings saved");
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <FormField label="Title" required error={form.fieldErrors.title}>
          {(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
        </FormField>
        <FormField label="Description" error={form.fieldErrors.description}>
          {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start" error={form.fieldErrors.startsAt}>
            {(p) => (
              <Input {...p} type="datetime-local" name="startsAt" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            )}
          </FormField>
          <FormField label="End" error={form.fieldErrors.endsAt}>
            {(p) => (
              <Input {...p} type="datetime-local" name="endsAt" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            )}
          </FormField>
        </div>
        <FormField label="Location" error={form.fieldErrors.location}>
          {(p) => <Input {...p} value={location} maxLength={200} onChange={(e) => setLocation(e.target.value)} />}
        </FormField>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Review mode</legend>
          {REVIEW_OPTIONS.map((o) => (
            <label key={o.value} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="reviewMode"
                value={o.value}
                checked={reviewMode === o.value}
                onChange={() => setReviewMode(o.value)}
                className="size-5 cursor-pointer accent-primary"
              />
              {o.label}
            </label>
          ))}
          {reviewMode !== event.reviewMode ? (
            <p role="note" className="text-sm text-foreground-muted">
              Tasks already submitted stay submitted; managers can verify them.
            </p>
          ) : null}
        </fieldset>
      </fieldset>
      <FormError message={form.formError} />
      {readOnly ? null : (
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="submit" loading={form.pending}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}
