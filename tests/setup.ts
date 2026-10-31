import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register this itself.
// Integration tests run in the node environment (no DOM): nothing to clean.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

// jsdom lacks a few browser APIs that Radix (popper, menus) calls.
if (typeof window !== "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??= ResizeObserverStub;
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
