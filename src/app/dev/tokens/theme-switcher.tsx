"use client";

import { useTheme } from "next-themes";

const MODES = ["system", "light", "dark"] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex gap-2" role="group" aria-label="Theme">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setTheme(mode)}
          aria-pressed={theme === mode}
          className="h-10 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
