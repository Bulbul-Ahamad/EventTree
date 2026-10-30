"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useFormAction } from "@/features/auth/components/use-form-action";
import { createOrganization, joinOrganization } from "@/features/orgs/actions";
import {
  ORG_KINDS,
  ORG_KIND_LABELS,
  createOrganizationSchema,
  joinOrganizationSchema,
  type OrgKind,
} from "@/features/orgs/schemas";
import { slugify } from "@/features/orgs/slug";
import { fieldErrorsFrom } from "@/lib/action-result";
import { cn } from "@/lib/utils";

function CreateCard({ className }: { className?: string }) {
  const router = useRouter();
  const form = useFormAction();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [kind, setKind] = useState<OrgKind>("club");

  function onName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { name, slug, kind };
    const parsed = createOrganizationSchema.safeParse(input);
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => createOrganization(input),
      ({ slug: created }) => router.push(`/o/${created}/events`),
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create an organization</CardTitle>
        <CardDescription>You will be its admin.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Name" required error={form.fieldErrors.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => onName(e.target.value)} />}
        </FormField>
        <FormField
          label="URL name"
          required
          hint="Letters, numbers and dashes. Used in your links."
          error={form.fieldErrors.slug}
        >
          {(p) => (
            <Input
              {...p}
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.toLowerCase());
              }}
            />
          )}
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
        <FormError message={form.formError} />
        <Button type="submit" loading={form.pending} className="w-full">
          Create
        </Button>
      </form>
    </Card>
  );
}

function JoinCard({ className }: { className?: string }) {
  const router = useRouter();
  const form = useFormAction();
  const [code, setCode] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = joinOrganizationSchema.safeParse({ code });
    if (!parsed.success) {
      form.reset();
      form.setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    form.run(
      () => joinOrganization({ code }),
      ({ slug }) => router.push(`/o/${slug}/events`),
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Join with a code</CardTitle>
        <CardDescription>Ask an organization admin for the join code.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormField label="Join code" required error={form.fieldErrors.code}>
          {(p) => (
            <Input
              {...p}
              value={code}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono uppercase"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          )}
        </FormField>
        <FormError message={form.formError} />
        <Button type="submit" loading={form.pending} className="w-full">
          Join
        </Button>
      </form>
    </Card>
  );
}

// Two cards side by side from md; a two-tab switch on mobile (02_AppFlow S07).
export function OnboardingForms() {
  const [tab, setTab] = useState<"create" | "join">("create");
  const tabClass = (t: "create" | "join") =>
    cn(
      "h-9 flex-1 cursor-pointer rounded-sm text-sm font-medium text-foreground-muted transition-colors duration-150",
      tab === t && "bg-surface text-foreground shadow-sm dark:bg-primary-soft dark:text-primary",
    );

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Choose an option" className="flex rounded-md bg-surface-muted p-1 md:hidden">
        <button type="button" aria-pressed={tab === "create"} className={tabClass("create")} onClick={() => setTab("create")}>
          Create
        </button>
        <button type="button" aria-pressed={tab === "join"} className={tabClass("join")} onClick={() => setTab("join")}>
          Join
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        <CreateCard className={tab === "create" ? "" : "hidden md:flex"} />
        <JoinCard className={tab === "join" ? "" : "hidden md:flex"} />
      </div>
    </div>
  );
}
