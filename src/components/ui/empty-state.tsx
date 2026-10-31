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
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-10 text-center", className)}>
      <Icon aria-hidden className="size-10 text-foreground-subtle" />
      <h2 className="text-balance text-lg font-semibold">{title}</h2>
      {description ? <p className="max-w-[360px] text-sm text-foreground-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
