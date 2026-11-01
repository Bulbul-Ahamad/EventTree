import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The boundary refetches through the router before it re-renders.
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";

describe("not-found page", () => {
  it("says the page was not found and links to the dashboard", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "We couldn't find that page." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
  });
});

describe("error boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers Try again and Go to dashboard", async () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error("boom")} reset={reset} />);
    expect(screen.getByRole("heading", { name: "Something went wrong." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("never shows the error text or stack to the user", () => {
    const err = Object.assign(new Error('relation "nodes" does not exist'), { digest: "abc123" });
    const { container } = render(<ErrorPage error={err} reset={() => {}} />);
    expect(container.textContent).not.toMatch(/relation|nodes|abc123|Error:/);
  });

  it("logs only the digest", () => {
    const err = Object.assign(new Error("secret internals"), { digest: "d1g3st" });
    render(<ErrorPage error={err} reset={() => {}} />);
    expect(console.error).toHaveBeenCalledWith("Route error", "d1g3st");
  });
});
