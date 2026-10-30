import { toast } from "sonner";

// Single entry point for toasts so durations follow 03_UI_Spec §8.9.
// Client-side only. Messages are plain text.
export const notify = {
  success: (message: string) => toast.success(message, { duration: 3000 }),
  info: (message: string) => toast.info(message, { duration: 3000 }),
  error: (message: string) => toast.error(message, { duration: 6000 }),
};
