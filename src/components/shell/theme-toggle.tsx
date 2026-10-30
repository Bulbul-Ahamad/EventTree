"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", label: "System theme", Icon: Monitor },
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
] as const;

const subscribe = () => () => {};

// Segmented control (03_UI_Spec §8.13). The saved theme is only known in the
// browser, so selection is shown after mount to avoid a hydration mismatch.
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn("inline-flex rounded-md bg-surface-muted p-1", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-foreground-muted transition-colors duration-150 hover:text-foreground [&_svg]:size-4",
              selected && "bg-surface text-foreground shadow-sm dark:bg-primary-soft dark:text-primary",
            )}
          >
            <Icon aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
