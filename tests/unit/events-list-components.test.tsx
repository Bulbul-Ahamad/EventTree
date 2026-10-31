import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/o/acme/events",
}));

import { EventCard } from "@/features/events/components/event-card";
import { EventTabs } from "@/features/events/components/event-tabs";
import type { EventSummary } from "@/features/events/queries";

const EVENT: EventSummary = {
  id: "e1",
  title: "Tech Fest",
  status: "active",
  startsAt: "2026-11-01T10:00:00.000Z",
  endsAt: null,
  location: null,
  progress: 42,
  ownerId: "u1",
  ownerName: "Bulbul Ahmed",
  ownerAvatar: null,
};

describe("EventCard", () => {
  it("is one link to the event with the title as its name", () => {
    render(<ul><EventCard event={EVENT} orgSlug="acme" /></ul>);
    expect(screen.getByRole("link", { name: "Tech Fest" })).toHaveAttribute("href", "/o/acme/events/e1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows status, progress and the owner", () => {
    render(<ul><EventCard event={EVENT} orgSlug="acme" /></ul>);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tech Fest progress" })).toHaveAttribute("aria-valuenow", "42");
    expect(screen.getByText("Owner: Bulbul Ahmed")).toBeInTheDocument();
  });

  it("handles a missing owner and no dates", () => {
    render(<ul><EventCard event={{ ...EVENT, ownerId: null, ownerName: null, startsAt: null }} orgSlug="acme" /></ul>);
    expect(screen.getByText("No owner")).toBeInTheDocument();
  });

  it("renders titles as plain text (no HTML injection)", () => {
    const { container } = render(<ul><EventCard event={{ ...EVENT, title: "<img src=x onerror=alert(1)>" }} orgSlug="acme" /></ul>);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });

  it("encodes the org slug in the link", () => {
    render(<ul><EventCard event={EVENT} orgSlug="a b" /></ul>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/o/a%20b/events/e1");
  });
});

describe("EventTabs", () => {
  beforeEach(() => replace.mockClear());

  it("lists the three tabs with the current one selected", () => {
    render(<EventTabs value="completed" />);
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Archived" })).toBeInTheDocument();
  });

  it("puts the tab in the URL, and keeps the URL clean for Active", () => {
    render(<EventTabs value="active" />);
    fireEvent.click(screen.getByRole("tab", { name: "Archived" }));
    expect(replace).toHaveBeenCalledWith("/o/acme/events?tab=archived");
    replace.mockClear();
    render(<EventTabs value="completed" />);
    fireEvent.click(screen.getAllByRole("tab", { name: "Active" })[1] as HTMLElement);
    expect(replace).toHaveBeenCalledWith("/o/acme/events");
  });
});
