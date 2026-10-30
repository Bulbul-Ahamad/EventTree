import { AlertCircle } from "lucide-react";

// Form-level error. Announced to screen readers (03_UI_Spec §10).
export function FormError({ message }: { message: string | null }) {
  return (
    <div aria-live="polite">
      {message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      ) : null}
    </div>
  );
}
