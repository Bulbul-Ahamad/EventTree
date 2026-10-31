import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventHeader } from "@/features/events/components/event-header";
import { lifecycleSteps } from "@/features/events/lifecycle";
import type { EventDetail } from "@/features/events/queries";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/o/acme/events/e1",
  useSearchParams: () => new URLSearchParams(),
}));
const setEventStatus = vi.fn();
vi.mock("@/features/events/actions", () => ({ setEventStatus: (i: unknown) => setEventStatus(i) }));
vi.mock("@/lib/toast", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const EVENT: EventDetail = {
  id: "e1",
  orgId: "o1",
  title: "Tech Fest",
  description: null,
  status: "draft",
  reviewMode: "assignee_submits",
  startsAt: null,
  endsAt: null,
  location: "DUET Auditorium",
  completedAt: null,
  progress: 40,
  ownerId: "u1",
  ownerName: "Bulbul Ahamad",
  ownerAvatar: null,
};

function header(over: Partial<EventDetail> = {}, isOwner = true, unassignedCount = 0) {
  return render(
    <EventHeader
      event={{ ...EVENT, ...over }}
      isOwner={isOwner}
      unassignedCount={unassignedCount}
      settingsHref="/o/acme/events/e1/settings"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("lifecycleSteps", () => {
  it("offers the next steps per status (02_AppFlow §6)", () => {
    const f = { progress: 100, unassignedCount: 0 };
    expect(lifecycleSteps("draft", f).map((s) => s.to)).toEqual(["active"]);
    expect(lifecycleSteps("active", f).map((s) => s.to)).toEqual(["completed"]);
    expect(lifecycleSteps("completed", f).map((s) => s.label)).toEqual(["Reopen", "Archive"]);
    expect(lifecycleSteps("archived", f).map((s) => s.label)).toEqual(["Unarchive"]);
  });

  it("warns about unassigned items when activating, only if there are some", () => {
    expect(lifecycleSteps("draft", { progress: 0, unassignedCount: 0 })[0]?.warning).toBeNull();
    expect(lifecycleSteps("draft", { progress: 0, unassignedCount: 1 })[0]?.warning).toMatch(/1 item has no assignee/);
    expect(lifecycleSteps("draft", { progress: 0, unassignedCount: 3 })[0]?.warning).toMatch(/3 items have no assignee/);
  });

  it("warns when completing below 100 %", () => {
    expect(lifecycleSteps("active", { progress: 60, unassignedCount: 0 })[0]?.warning).toMatch(/60%/);
    expect(lifecycleSteps("active", { progress: 100, unassignedCount: 0 })[0]?.warning).toBeNull();
  });
});

describe("EventHeader", () => {
  it("shows title, status, location, owner and overall progress", () => {
    header({ status: "active" });
    expect(screen.getByRole("heading", { name: "Tech Fest" })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("DUET Auditorium")).toBeInTheDocument();
    expect(screen.getByText("Owner: Bulbul Ahamad")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tech Fest overall progress" })).toHaveAttribute("aria-valuenow", "40");
  });

  it("shows the draft banner in draft, the read-only banner when completed or archived, none when active", () => {
    const draft = header({ status: "draft" });
    expect(screen.getByText(/Draft — task updates are disabled until the owner activates the event\./)).toBeInTheDocument();
    draft.unmount();
    const done = header({ status: "completed" });
    expect(screen.getByText("This event is read-only.")).toBeInTheDocument();
    done.unmount();
    const archived = header({ status: "archived" });
    expect(screen.getByText("This event is read-only.")).toBeInTheDocument();
    archived.unmount();
    header({ status: "active" });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gives lifecycle buttons and Settings to the owner only", () => {
    const owner = header({ status: "draft" }, true);
    expect(screen.getByRole("button", { name: "Activate event" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/o/acme/events/e1/settings");
    owner.unmount();
    header({ status: "draft" }, false);
    expect(screen.queryByRole("button", { name: "Activate event" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  it("confirms before changing status, then calls the action and refreshes", async () => {
    setEventStatus.mockResolvedValue({ ok: true, data: undefined });
    header({ status: "draft" }, true, 2);
    fireEvent.click(screen.getByRole("button", { name: "Activate event" }));
    expect(setEventStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/2 items have no assignee yet/)).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Activate event" }));
    await waitFor(() => expect(setEventStatus).toHaveBeenCalledWith({ eventId: "e1", to: "active" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("cancel leaves the status alone and shows an error message when the action fails", async () => {
    header({ status: "active" });
    fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(setEventStatus).not.toHaveBeenCalled();

    setEventStatus.mockResolvedValue({ ok: false, code: "E_INVALID_TRANSITION", message: "That change is not allowed." });
    fireEvent.click(screen.getByRole("button", { name: "Mark completed" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark completed" }));
    expect(await screen.findByText(/That change is not allowed\./)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

