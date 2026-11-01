import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

import AuthLoading from "@/app/(auth)/loading";
import DashboardLoading from "@/app/dashboard/loading";
import OnboardingLoading from "@/app/onboarding/loading";
import OrgLoading from "@/app/o/[orgSlug]/loading";
import EventsLoading from "@/app/o/[orgSlug]/events/loading";
import NewEventLoading from "@/app/o/[orgSlug]/events/new/loading";
import EventLoading from "@/app/o/[orgSlug]/events/[eventId]/loading";
import EventSettingsLoading from "@/app/o/[orgSlug]/events/[eventId]/settings/loading";
import MembersLoading from "@/app/o/[orgSlug]/members/loading";
import OrgSettingsLoading from "@/app/o/[orgSlug]/settings/loading";
import ProfileLoading from "@/app/settings/profile/loading";
import ErrorPage from "@/app/error";
import EventError from "@/app/o/[orgSlug]/events/[eventId]/error";
import { RouteError } from "@/components/ui/route-error";

const APP = join(process.cwd(), "src", "app");

// Every folder under src/app that holds a page.tsx, as a path from src/app ("" is the landing page).
function pageDirs(dir = APP): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(...pageDirs(join(dir, entry.name)));
    else if (entry.name === "page.tsx") found.push(relative(APP, dir));
  }
  return found;
}

// The folder itself or any parent below src/app that holds `file`.
function coveredBy(pageDir: string, file: string, includeRoot: boolean): boolean {
  const parts = pageDir === "" ? [] : pageDir.split(sep);
  for (let n = parts.length; n >= (includeRoot ? 0 : 1); n--) {
    if (existsSync(join(APP, ...parts.slice(0, n), file))) return true;
  }
  return false;
}

describe("every route has a loading skeleton and an error boundary (02_AppFlow §1)", () => {
  const dirs = pageDirs().filter((d) => d !== ""); // the landing page redirects or renders statically

  it("finds the routes", () => {
    expect(dirs.length).toBeGreaterThanOrEqual(12);
  });

  it.each(dirs)("%s has loading.tsx on itself or a parent segment", (dir) => {
    expect(coveredBy(dir, "loading.tsx", false)).toBe(true);
  });

  it.each(dirs)("%s has an error boundary", (dir) => {
    expect(coveredBy(dir, "error.tsx", true)).toBe(true);
  });

  it.each(dirs.filter((d) => d.startsWith("o") || d.startsWith("dashboard") || d.startsWith("settings")))(
    "%s keeps the navigation when it fails (boundary below the shell layout)",
    (dir) => {
      expect(coveredBy(dir, "error.tsx", false)).toBe(true);
    },
  );

  it("the event tree page has its own boundary and skeleton", () => {
    expect(existsSync(join(APP, "o", "[orgSlug]", "events", "[eventId]", "error.tsx"))).toBe(true);
    expect(existsSync(join(APP, "o", "[orgSlug]", "events", "[eventId]", "loading.tsx"))).toBe(true);
  });
});

describe("loading skeletons", () => {
  const all: Array<[string, () => React.ReactElement]> = [
    ["auth", AuthLoading],
    ["dashboard", DashboardLoading],
    ["onboarding", OnboardingLoading],
    ["org fallback", OrgLoading],
    ["events", EventsLoading],
    ["new event", NewEventLoading],
    ["event tree", EventLoading],
    ["event settings", EventSettingsLoading],
    ["members", MembersLoading],
    ["org settings", OrgSettingsLoading],
    ["profile", ProfileLoading],
  ];

  it.each(all)("%s renders a polite status region and no text content to read twice", (_name, Loading) => {
    const { container } = render(<Loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});

describe("RouteError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  const boom = Object.assign(new Error("secret db detail"), { digest: "abc123" });

  it("says something went wrong, hides the error text, and offers both ways out", () => {
    render(<RouteError error={boom} reset={vi.fn()} />);
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.queryByText(/secret db detail/)).toBeNull();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(console.error).toHaveBeenCalledWith("Route error", "abc123");
  });

  it("Try again refetches from the server and re-renders the segment", async () => {
    const reset = vi.fn();
    render(<RouteError error={boom} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("the root and event boundaries use it", () => {
    const a = render(<ErrorPage error={boom} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    a.unmount();
    render(<EventError error={boom} reset={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
