"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

// 03_UI_Spec §8.9: bottom-right on desktop (sonner goes full-width bottom on
// small screens), success 3 s, errors 6 s (set in lib/toast.ts), pause on hover.
// `unstyled` so only our tokens style the toast.
export function Toaster() {
  const { theme } = useTheme();
  const mode = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <Sonner
      theme={mode}
      position="bottom-right"
      duration={3000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-4 text-sm text-foreground shadow-md",
          title: "font-medium",
          description: "text-foreground-muted",
          success: "border-success",
          error: "border-danger",
          info: "border-info",
          icon: "mt-0.5 shrink-0",
        },
      }}
    />
  );
}
