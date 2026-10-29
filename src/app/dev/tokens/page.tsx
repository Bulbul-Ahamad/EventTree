import { notFound } from "next/navigation";
import { ThemeSwitcher } from "./theme-switcher";

// Temporary visual check for step 1.21. Dev only; remove with the landing page (3.03).
const SWATCHES = [
  "bg-background",
  "bg-surface",
  "bg-surface-muted",
  "bg-primary",
  "bg-primary-soft",
  "bg-success-soft",
  "bg-warning-soft",
  "bg-danger-soft",
  "bg-info-soft",
] as const;

const STATUSES = ["todo", "in_progress", "submitted", "verified"] as const;
const STATUS_CLASS = {
  todo: "bg-status-todo-bg text-status-todo-fg",
  in_progress: "bg-status-in_progress-bg text-status-in_progress-fg",
  submitted: "bg-status-submitted-bg text-status-submitted-fg",
  verified: "bg-status-verified-bg text-status-verified-fg",
} as const;

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-4 md:p-6">
      <h1 className="text-balance text-2xl font-bold md:text-3xl">Design tokens</h1>
      <ThemeSwitcher />

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:p-6">
        <h2 className="text-xl font-semibold">Surface and text</h2>
        <p className="text-base text-foreground">Primary text on surface.</p>
        <p className="text-sm text-foreground-muted">Muted text.</p>
        <p className="text-sm text-foreground-subtle">Subtle text.</p>
        <p className="font-mono text-sm">JOINCODE12AB (mono)</p>
      </section>

      <section className="flex flex-wrap gap-3">
        {SWATCHES.map((cls) => (
          <div
            key={cls}
            className={`${cls} flex h-12 w-24 items-center justify-center rounded-md border border-border text-xs text-foreground`}
          >
            {cls.replace("bg-", "")}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <span
            key={s}
            className={`${STATUS_CLASS[s]} inline-flex h-6 items-center rounded-full px-2 text-xs font-medium`}
          >
            {s}
          </span>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-6">
        <h2 className="text-xl font-semibold">Bangla sample</h2>
        <p lang="bn" className="text-base">
          ইভেন্ট ম্যানেজমেন্ট সিস্টেম: প্রতিটি সেগমেন্টে একজন দায়িত্বশীল ব্যক্তি থাকবেন এবং কাজের অগ্রগতি স্বয়ংক্রিয়ভাবে হিসাব হবে।
        </p>
        <p lang="bn" className="text-sm text-foreground-muted">
          ক্লাব, সংগঠন ও বিশ্ববিদ্যালয়ের প্রোগ্রাম — যুক্তাক্ষর: ক্ষ, জ্ঞ, শ্র, ত্র।
        </p>
      </section>
    </main>
  );
}
