import { Info, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.14: draft (info) or read-only (warning) strip in the event header.
const VARIANTS = {
  draft: { icon: Info, style: "bg-info-soft" },
  readonly: { icon: Lock, style: "bg-warning-soft" },
} as const;

type BannerProps = { variant: keyof typeof VARIANTS; children: ReactNode; className?: string };

export function Banner({ variant, children, className }: BannerProps) {
  const { icon: Icon, style } = VARIANTS[variant];
  return (
    <div role="status" className={cn("flex w-full items-start gap-2 px-4 py-2 text-sm text-foreground", style, className)}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
