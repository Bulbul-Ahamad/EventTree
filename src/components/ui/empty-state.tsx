import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.10. Copy comes from 02_AppFlow. At most one primary CTA.
type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  // Full-page states (error, not found) are the page's only heading: use 1.
  headingLevel?: 1 | 2;
};

export function EmptyState({ icon: Icon, title, description, action, className, headingLevel = 2 }: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <Icon aria-hidden className="size-10 text-foreground-subtle" />
      <Heading className="text-balance text-lg font-semibold">{title}</Heading>
      {description ? <p className="max-w-[360px] text-sm text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
