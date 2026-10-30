import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register this itself.
// Integration tests run in the node environment (no DOM): nothing to clean.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
