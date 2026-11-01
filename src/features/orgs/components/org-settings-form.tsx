"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { updateOrganization } from "@/features/orgs/actions";
import { ORG_KINDS, ORG_KIND_LABELS, updateOrganizationSchema, type OrgKind } from "@/features/orgs/schemas";
import { fieldErrorsFrom } from "@/lib/action-result";
import { notify } from "@/lib/toast";

// S16: name and type. The URL name is shown but cannot be changed.
export function OrgSettingsForm({ org }: { org: { id: string; name: string; slug: string; kind: OrgKind } }) {
  const router = useRouter();
  const form = useFormAction();
  const [name, setName] = useState(org.name);
  const [kind, setKind] = useState<OrgKind>(org.kind);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { orgId: org.id, name, kind };
    const parsed = updateOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => updateOrganization(input),
      () => {
        notify.success("Organization updated");
        router.refresh();
      },
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormField label="Name" required error={form.fieldErrors.name}>
        {(p) => <Input {...p} value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />}
      </FormField>
      <FormField label="Type" required error={form.fieldErrors.kind}>
        {(p) => (
          <NativeSelect {...p} value={kind} onChange={(e) => setKind(e.target.value as OrgKind)}>
            {ORG_KINDS.map((k) => (
              <option key={k} value={k}>
                {ORG_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="URL name" hint="The URL name can't be changed.">
        {(p) => <Input {...p} value={org.slug} readOnly disabled />}
      </FormField>
      <FormError message={form.formError} />
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button type="submit" loading={form.pending}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
