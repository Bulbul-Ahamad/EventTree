import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const back = vi.fn();
const createEvent = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back, replace: vi.fn() }) }));
vi.mock("@/features/events/actions", () => ({ createEvent: (...a: unknown[]) => createEvent(...a) }));
vi.mock("@/lib/toast", () => ({ notify: { success: (m: string) => success(m), error: (m: string) => error(m), info: vi.fn() } }));

import { NewEventForm } from "@/features/events/components/new-event-form";

const ORG = "11111111-1111-1111-1111-111111111111";
const EVENT = "22222222-2222-2222-2222-222222222222";

function setup() {
  render(<NewEventForm orgId={ORG} orgSlug="acme" />);
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });

describe("NewEventForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the spec fields and both review modes, recommended one selected", () => {
    setup();
    for (const label of ["Title", "Description", "Start", "End", "Location"]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByRole("radio", { name: "Assignees submit, managers verify (recommended)" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Managers tick tasks directly" })).not.toBeChecked();
  });

  it("requires a title and does not call the action", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a title.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("aria-invalid", "true");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("shows the end-before-start error on End", () => {
    setup();
    type("Title", "Fest");
    type("Start", "2026-11-02T10:00");
    type("End", "2026-11-01T10:00");
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("End must be on or after the start.")).toBeInTheDocument();
    expect(screen.getByLabelText("End")).toHaveAttribute("aria-invalid", "true");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("refuses a date without a time instead of silently saving no date", () => {
    setup();
    type("Title", "Fest");
    const start = screen.getByLabelText("Start") as HTMLInputElement;
    // The user had a full value, then clears the time part: the browser reports "" with
    // badInput. (React ignores a change to the same value, so start from a real one.)
    fireEvent.change(start, { target: { value: "2026-11-01T10:00" } });
    Object.defineProperty(start, "validity", { value: { badInput: true }, configurable: true });
    fireEvent.change(start, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a complete date and time.")).toBeInTheDocument();
    expect(start).toHaveAttribute("aria-invalid", "true");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("catches a half-filled date even when no change event ever fired", () => {
    setup();
    type("Title", "Fest");
    const start = screen.getByLabelText("Start") as HTMLInputElement;
    // Firefox: only the date part typed, value stays "" and badInput is true.
    Object.defineProperty(start, "validity", { value: { badInput: true }, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(screen.getByText("Enter a complete date and time.")).toBeInTheDocument();
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("creates the event, toasts 'Event created as draft' and opens it", async () => {
    createEvent.mockResolvedValue({ ok: true, data: { eventId: EVENT } });
    setup();
    type("Title", "Tech Fest");
    type("Location", "Main hall");
    fireEvent.click(screen.getByRole("radio", { name: "Managers tick tasks directly" }));
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/o/acme/events/${EVENT}`));
    expect(success).toHaveBeenCalledWith("Event created as draft");
    expect(createEvent).toHaveBeenCalledWith({
      orgId: ORG,
      title: "Tech Fest",
      description: "",
      startsAt: null,
      endsAt: null,
      location: "Main hall",
      reviewMode: "head_only",
    });
  });

  it("sends dates as ISO strings", async () => {
    createEvent.mockResolvedValue({ ok: true, data: { eventId: EVENT } });
    setup();
    type("Title", "Fest");
    type("Start", "2026-11-01T10:00");
    type("End", "2026-11-02T18:00");
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    await waitFor(() => expect(createEvent).toHaveBeenCalled());
    const arg = createEvent.mock.calls[0]?.[0] as { startsAt: string; endsAt: string };
    expect(arg.startsAt).toMatch(/Z$/);
    expect(new Date(arg.endsAt).getTime()).toBeGreaterThan(new Date(arg.startsAt).getTime());
  });

  it("shows a server error without navigating", async () => {
    createEvent.mockResolvedValue({ ok: false, code: "E_NOT_AUTHORIZED", message: "You don't have permission to do that." });
    setup();
    type("Title", "Fest");
    fireEvent.click(screen.getByRole("button", { name: "Create event" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You don't have permission to do that.");
    expect(push).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it("Cancel goes back", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
