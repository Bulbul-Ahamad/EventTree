import { AlertCircle } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

type ControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
  "aria-required": true | undefined;
};

// Label above control, optional hint, error with icon (03_UI_Spec §8.2, §10).
// Usage: <FormField label="Email" error={e}>{(p) => <Input {...p} />}</FormField>
export function FormField({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  children: (control: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} required={required ?? false}>
        {label}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      ) : null}
      <div aria-live="polite">
        {error ? (
          <p
            id={errorId}
            className="flex items-center gap-1 text-sm text-danger"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
