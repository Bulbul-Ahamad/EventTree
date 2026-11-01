import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
const updateEventSettings = vi.fn();
const deleteEvent = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, back: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/features/events/actions", () => ({
  updateEventSettings: (...a: unknown[]) => updateEventSettings(...a),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
}));
vi.mock("@/lib/toast", () => ({ notify: { success: (m: string) => success(m), error: (m: string) => error(m), info: vi.fn() } }));

import { EventDangerZone } from "@/features/events/components/event-danger-zone";
import { EventSettingsForm } from "@/features/events/components/event-settings-form";
import { fail, ok } from "@/lib/action-result";
import type { EventDetail } from "@/features/events/queries";
import { canDeleteEvent, canEditEventSettings, type EventContext } from "@/lib/permissions";

const EVENT_ID = "22222222-2222-2222-2222-222222222222";
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";

function event(over: Partial<EventDetail> = {}): EventDetail {
  return {
    id: EVENT_ID, orgId: "11111111-1111-1111-1111-111111111111", title: "Tech Fest", description: "Annual fest",
    status: "draft", reviewMode: "assignee_submits", startsAt: "2026-11-10T04:00:00.000Z", endsAt: "2026-11-11T04:00:00.000Z",
    location: "Gazipur", completedAt: null, progress: 0, ownerId: OWNER, ownerName: "Bulbul", ownerAvatar: null, ...over,
  };
}
const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`));
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EventSettingsForm", () => {
  it("starts with the event's current values", () => {
    render(<EventSettingsForm event={event()} readOnly={false} />);
    expect(field("Title")).toHaveValue("Tech Fest");
    expect(field("Description")).toHaveValue("Annual fest");
    expect(field("Location")).toHaveValue("Gazipur");
    expect(field("Start")).not.toHaveValue("");
    expect(screen.getByRole("radio", { name: /^Assignees submit/ })).toBeChecked();
  });

  it("shows the review-mode note only after the mode is changed", () => {
    render(<EventSettingsForm event={event()} readOnly={false} />);
    const note = "Tasks already submitted stay submitted; managers can verify them.";
    expect(screen.queryByText(note)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Managers tick tasks directly" }));
    expect(screen.getByText(note)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /^Assignees submit/ }));
    expect(screen.queryByText(note)).toBeNull();
  });

  it("saves the changes, toasts and refreshes", async () => {
    updateEventSettings.mockResolvedValue(ok());
    render(<EventSettingsForm event={event()} readOnly={false} />);
    type("Title", "Tech Fest 2026");
    fireEvent.click(screen.getByRole("radio", { name: "Managers tick tasks directly" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Event settings saved"));
    expect(updateEventSettings).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT_ID, title: "Tech Fest 2026", reviewMode: "head_only", location: "Gazipur" }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("needs a title and an end that is not before the start", () => {
    render(<EventSettingsForm event={event()} readOnly={false} />);
    type("Title", "   ");
    type("End", "2020-01-01T10:00");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter a title.")).toBeInTheDocument();
    expect(screen.getByText("End must be on or after the start.")).toBeInTheDocument();
    expect(updateEventSettings).not.toHaveBeenCalled();
  });

  it("shows a server error under the form", async () => {
    updateEventSettings.mockResolvedValue(fail("E_EVENT_READONLY"));
    render(<EventSettingsForm event={event()} readOnly={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This event is read-only.")).toBeInTheDocument();
    expect(success).not.toHaveBeenCalled();
  });

  it("is read-only for a completed event: fields disabled, no Save button", () => {
    render(<EventSettingsForm event={event({ status: "completed" })} readOnly />);
    expect(field("Title")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Managers tick tasks directly" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });
});

describe("EventDangerZone", () => {
  const zone = (canDelete: boolean) =>
    render(<EventDangerZone eventId={EVENT_ID} title="Tech Fest" canDelete={canDelete} eventsHref="/o/acme/events" />);

  it("keeps Delete disabled, and says why, while the event is active or completed", () => {
    zone(false);
    expect(screen.getByRole("button", { name: "Delete event" })).toBeDisabled();
    expect(screen.getByText("An event can be deleted only while it is a draft or archived.")).toBeInTheDocument();
  });

  it("needs the exact title typed before the final button works", () => {
    zone(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this event?" });
    const confirm = within(dialog).getByRole("button", { name: "Delete event" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^Type the event title/), { target: { value: "Tech" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/^Type the event title/), { target: { value: "Tech Fest" } });
    expect(confirm).toBeEnabled();
  });

  it("deletes, toasts and goes to the events list", async () => {
    deleteEvent.mockResolvedValue(ok());
    zone(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this event?" });
    fireEvent.change(within(dialog).getByLabelText(/^Type the event title/), { target: { value: "Tech Fest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete event" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/o/acme/events"));
    expect(deleteEvent).toHaveBeenCalledWith({ eventId: EVENT_ID });
    expect(success).toHaveBeenCalledWith("Event deleted");
  });

  it("shows the server's reason and stays on the page when it refuses", async () => {
    deleteEvent.mockResolvedValue(fail("E_EVENT_READONLY"));
    zone(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete event" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this event?" });
    fireEvent.change(within(dialog).getByLabelText(/^Type the event title/), { target: { value: "Tech Fest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete event" }));
    expect(await within(dialog).findByText("This event is read-only.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("who reaches the settings page", () => {
  const ctx = (userId: string, over: Partial<EventContext> = {}): EventContext => ({
    userId, ownerId: OWNER, eventStatus: "draft", reviewMode: "assignee_submits", isOrgAdmin: false, isParticipant: true, ...over,
  });

  it("only the owner may edit, and delete is limited to draft and archived", () => {
    expect(canEditEventSettings(ctx(OWNER))).toBe(true);
    expect(canEditEventSettings(ctx(OTHER))).toBe(false);
    expect(canEditEventSettings(ctx(OTHER, { isOrgAdmin: true }))).toBe(false);
    for (const [status, expected] of [["draft", true], ["active", false], ["completed", false], ["archived", true]] as const) {
      expect(canDeleteEvent(ctx(OWNER, { eventStatus: status }))).toBe(expected);
    }
    expect(canDeleteEvent(ctx(OTHER))).toBe(false);
  });
});
