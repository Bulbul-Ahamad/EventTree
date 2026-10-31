import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 03_UI_Spec §8.12. Initials only in the MVP (profile photos are in the parking
// lot). Initials use Array.from so Bangla letters are not split mid-character.

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

// Same id always gives the same tint (6 fixed tints from the primary family).
const TINTS = [
  "bg-primary-soft",
  "bg-primary/10",
  "bg-primary/15",
  "bg-primary/20",
  "bg-primary/25",
  "bg-primary/30",
] as const;

export function tintIndexOf(id: string): number {
  let hash = 0;
  for (const ch of Array.from(id)) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return hash % TINTS.length;
}

const SIZES = { sm: "size-6 text-xs", md: "size-8 text-sm", lg: "size-10 text-base" } as const;

type AvatarProps = Omit<ComponentProps<"span">, "children"> & {
  id: string;
  name: string | null | undefined;
  size?: keyof typeof SIZES;
};

// Decorative by default: the name should appear in text next to it. Pass
// aria-label (and no aria-hidden) when the avatar stands alone.
export function Avatar({ id, name, size = "md", className, ...props }: AvatarProps) {
  const standalone = props["aria-label"] !== undefined;
  return (
    <span
      role={standalone ? "img" : undefined}
      aria-hidden={standalone ? undefined : true}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-primary",
        TINTS[tintIndexOf(id)],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {initialsOf(name)}
    </span>
  );
}
