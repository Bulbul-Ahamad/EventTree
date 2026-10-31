"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { createEvent } from "@/features/events/actions";
import { createEventSchema } from "@/features/events/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { localInputToIso } from "@/lib/format-date";
import { notify } from "@/lib/toast";

const INCOMPLETE_DATE = "Enter a complete date and time.";

const REVIEW_OPTIONS = [
  { value: "assignee_submits", label: "Assignees submit, managers verify (recommended)" },
  { value: "head_only", label: "Managers tick tasks directly" },
] as const;

// S10 (02_AppFlow). Validates with the same Zod schema the action uses; on success
// goes to the new event (a draft) with a toast.
export function NewEventForm({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const router = useRouter();
  const form = useFormAction();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  // A datetime-local that is only partly filled (for example a date without a time)
  // reports value "" and validity.badInput; without this it would be saved as "no date".
  const [location, setLocation] = useState("");
  const [reviewMode, setReviewMode] = useState<(typeof REVIEW_OPTIONS)[number]["value"]>("assignee_submits");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Read at submit time: a half-filled field never fires onChange (its value stays "").
    const incomplete = (name: string) => {
      const el = e.currentTarget.elements.namedItem(name);
      return el instanceof HTMLInputElement && el.validity.badInput;
    };
    const startsIncomplete = incomplete("startsAt");
    const endsIncomplete = incomplete("endsAt");
    const input = {
      orgId,
      title,
      description,
      startsAt: localInputToIso(startsAt),
      endsAt: localInputToIso(endsAt),
      location,
      reviewMode,
    };
    const parsed = createEventSchema.safeParse(input);
    const errors = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    if (startsIncomplete) errors.startsAt = INCOMPLETE_DATE;
    if (endsIncomplete) errors.endsAt = INCOMPLETE_DATE;
    if (!parsed.success || startsIncomplete || endsIncomplete) {
      form.reset();
      form.setFieldErrors(errors);
      return;
    }
    form.run(
      () => createEvent(input),
      ({ eventId }) => {
        notify.success("Event created as draft");
        router.push(`/o/${encodeURIComponent(orgSlug)}/events/${eventId}`);
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Title" required error={form.fieldErrors.title}>
        {(p) => <Input {...p} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
      </FormField>
      <FormField label="Description" error={form.fieldErrors.description}>
        {(p) => <Textarea {...p} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start" error={form.fieldErrors.startsAt}>
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={startsAt}
              name="startsAt"
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="End" error={form.fieldErrors.endsAt}>
          {(p) => (
            <Input
              {...p}
              type="datetime-local"
              value={endsAt}
              name="endsAt"
              onChange={(e) => setEndsAt(e.target.value)}
            />
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
      </fieldset>
      <FormError message={form.formError} />
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={form.pending}>
          Create event
        </Button>
      </div>
    </form>
  );
}
