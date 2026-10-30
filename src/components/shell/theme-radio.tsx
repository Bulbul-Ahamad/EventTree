"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const subscribe = () => () => {};

// Theme preference as radios (02_AppFlow S17). Saved by next-themes in the browser.
export function ThemeRadio() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Theme</legend>
      {OPTIONS.map(({ value, label }) => (
        <label key={value} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
          <input
            type="radio"
            name="theme"
            value={value}
            checked={mounted && theme === value}
            onChange={() => setTheme(value)}
            className="size-5 cursor-pointer accent-primary"
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
