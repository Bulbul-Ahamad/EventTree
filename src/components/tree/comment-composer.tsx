"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { addCommentSchema, addProofLinkSchema } from "@/features/updates/schemas";
import { addComment, addProofLink } from "@/features/updates/actions";
import { fieldErrorsFrom } from "@/lib/action-result";
import { notify } from "@/lib/toast";

// S12 composer: a comment (<= 2000 characters) and an optional proof link. With a
// link the comment becomes its note. Shown only to people allowed to comment.
export function CommentComposer({ nodeId }: { nodeId: string }) {
  const router = useRouter();
  const form = useFormAction();
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const url = link.trim();
    if (url === "") {
      const parsed = addCommentSchema.safeParse({ nodeId, body });
      if (!parsed.success) {
        form.reset();
        form.setFieldErrors(fieldErrorsFrom(parsed.error));
        return;
      }
      form.run(
        () => addComment({ nodeId, body }),
        () => done("Comment posted"),
      );
      return;
    }
    const input = { nodeId, url, note: body };
    const parsed = addProofLinkSchema.safeParse(input);
    if (!parsed.success) {
      const errors = fieldErrorsFrom(parsed.error);
      form.reset();
      form.setFieldErrors(errors.note ? { ...errors, body: errors.note } : errors);
      return;
    }
    form.run(
      () => addProofLink(input),
      () => done("Proof link added"),
    );
  }

  function done(message: string) {
    setBody("");
    setLink("");
    notify.success(message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormField label="Comment" error={form.fieldErrors.body}>
        {(p) => <Textarea {...p} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />}
      </FormField>
      <FormField label="Proof link (optional)" error={form.fieldErrors.url}>
        {(p) => (
          <Input {...p} type="url" inputMode="url" value={link} maxLength={2000} placeholder="https://" onChange={(e) => setLink(e.target.value)} />
        )}
      </FormField>
      <FormError message={form.formError} />
      <div className="flex justify-end">
        <Button type="submit" loading={form.pending}>
          Post
        </Button>
      </div>
    </form>
  );
}
