import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh, back: vi.fn(), replace: vi.fn() }) }));
const setMemberRole = vi.fn();
const removeMember = vi.fn();
const rotateJoinCode = vi.fn();
const leaveOrganization = vi.fn();
const updateOrganization = vi.fn();
vi.mock("@/features/orgs/actions", () => ({
  setMemberRole: (i: unknown) => setMemberRole(i),
  removeMember: (i: unknown) => removeMember(i),
  rotateJoinCode: (i: unknown) => rotateJoinCode(i),
  leaveOrganization: (i: unknown) => leaveOrganization(i),
  updateOrganization: (i: unknown) => updateOrganization(i),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/lib/toast", () => ({ notify: toast }));

import { TooltipProvider } from "@/components/ui/tooltip";
import { JoinCodePanel } from "@/features/orgs/components/join-code-panel";
import { LeaveOrganization } from "@/features/orgs/components/leave-organization";
import { MembersList } from "@/features/orgs/components/members-list";
import { OrgSettingsForm } from "@/features/orgs/components/org-settings-form";
import type { OrgMember } from "@/features/orgs/queries";
import { updateOrganizationSchema } from "@/features/orgs/schemas";
import { fail, ok } from "@/lib/action-result";
import { formatDate } from "@/lib/format-date";

const ORG = "11111111-1111-1111-1111-111111111111";
const ME = "00000000-0000-4000-8000-0000000000a1";
const TANIA = "00000000-0000-4000-8000-0000000000a2";
const NILA = "00000000-0000-4000-8000-0000000000a3";

const members: OrgMember[] = [
  { userId: ME, fullName: "Bulbul", email: "bulbul@x.com", phone: "+8801700000001", avatarUrl: null, role: "admin", joinedAt: "2026-10-01T05:00:00.000Z" },
  { userId: TANIA, fullName: "Tania", email: "tania@x.com", phone: "+8801700000002", avatarUrl: null, role: "member", joinedAt: "2026-10-05T05:00:00.000Z" },
  { userId: NILA, fullName: "Nila", email: "nila@x.com", phone: "+8801700000003", avatarUrl: null, role: "member", joinedAt: "2026-10-06T05:00:00.000Z" },
];
const list = (viewerId: string, viewerIsAdmin: boolean) =>
  render(
    <TooltipProvider>
      <MembersList orgId={ORG} members={members} viewerId={viewerId} viewerIsAdmin={viewerIsAdmin} />
    </TooltipProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MembersList", () => {
  it("shows avatar initials, name, email, role and joined date for everyone", () => {
    list(TANIA, false);
    const row = screen.getByRole("row", { name: /Bulbul/ });
    expect(within(row).getByText("bulbul@x.com")).toBeInTheDocument();
    expect(within(row).getByText("Admin")).toBeInTheDocument();
    expect(within(row).getAllByText("+8801700000001").length).toBeGreaterThan(0); // US-18: members see the phone
    expect(within(row).getByText(formatDate("2026-10-01T05:00:00.000Z"))).toBeInTheDocument();
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it("gives a plain member no controls", () => {
    list(TANIA, false);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  });

  it("gives an admin a role select for everyone and Remove for everyone but themselves", () => {
    list(ME, true);
    expect(screen.getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Remove Tania" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Bulbul" })).toBeNull();
  });

  it("changes a role, toasts and refreshes", async () => {
    setMemberRole.mockResolvedValue(ok());
    list(ME, true);
    fireEvent.change(screen.getByRole("combobox", { name: "Role of Tania" }), { target: { value: "admin" } });
    await waitFor(() => expect(setMemberRole).toHaveBeenCalledWith({ orgId: ORG, userId: TANIA, role: "admin" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tania is now an admin"));
    expect(refresh).toHaveBeenCalled();
  });

  it("puts the old role back and shows E_LAST_ADMIN when demoting the last admin", async () => {
    setMemberRole.mockResolvedValue(fail("E_LAST_ADMIN"));
    list(ME, true);
    const select = screen.getByRole("combobox", { name: "Role of Bulbul" });
    fireEvent.change(select, { target: { value: "member" } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("An organization must keep at least one admin."));
    await waitFor(() => expect(select).toHaveValue("admin"));
  });

  it("asks before removing, and Cancel changes nothing", () => {
    list(ME, true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tania" }));
    const dialog = screen.getByRole("dialog", { name: "Remove Tania?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(removeMember).not.toHaveBeenCalled();
  });

  it("removes after confirming, toasts and refreshes", async () => {
    removeMember.mockResolvedValue(ok());
    list(ME, true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Nila" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Remove Nila?" })).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith({ orgId: ORG, userId: NILA }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Nila was removed"));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the owns-events message with the count", async () => {
    const message = "This member owns events. Resolve those first. (Events they own: 2)";
    removeMember.mockResolvedValue({ ok: false, code: "E_OWNS_EVENTS", message });
    list(ME, true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Tania" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Remove Tania?" })).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("JoinCodePanel", () => {
  const writeText = vi.fn();
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    writeText.mockReset().mockResolvedValue(undefined);
  });

  it("is masked until shown", () => {
    render(<JoinCodePanel orgId={ORG} joinCode="ABC123DEF456" />);
    expect(screen.getByTestId("join-code")).not.toHaveTextContent("ABC123DEF456");
    fireEvent.click(screen.getByRole("button", { name: "Show join code" }));
    expect(screen.getByTestId("join-code")).toHaveTextContent("ABC123DEF456");
    fireEvent.click(screen.getByRole("button", { name: "Hide join code" }));
    expect(screen.getByTestId("join-code")).not.toHaveTextContent("ABC123DEF456");
  });

  it("copies the real code even while masked", async () => {
    render(<JoinCodePanel orgId={ORG} joinCode="ABC123DEF456" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Join code copied"));
    expect(writeText).toHaveBeenCalledWith("ABC123DEF456");
  });

  it("tells the admin when copying is blocked", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<JoinCodePanel orgId={ORG} joinCode="ABC123DEF456" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("rotates only after confirming, and then shows the new code", async () => {
    rotateJoinCode.mockResolvedValue(ok({ joinCode: "NEWCODE00001" }));
    render(<JoinCodePanel orgId={ORG} joinCode="ABC123DEF456" />);
    fireEvent.click(screen.getByRole("button", { name: "Rotate" }));
    expect(rotateJoinCode).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Create a new join code?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rotate code" }));
    await waitFor(() => expect(rotateJoinCode).toHaveBeenCalledWith({ orgId: ORG }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("New join code created"));
    fireEvent.click(screen.getByRole("button", { name: "Show join code" }));
    expect(screen.getByTestId("join-code")).toHaveTextContent("NEWCODE00001");
  });
});

describe("LeaveOrganization", () => {
  it("leaves after confirming and goes to the dashboard", async () => {
    leaveOrganization.mockResolvedValue(ok());
    render(<LeaveOrganization orgId={ORG} orgName="DUET CSE" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave organization" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Leave DUET CSE?" })).getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(leaveOrganization).toHaveBeenCalledWith({ orgId: ORG });
  });

  it("shows the last-admin reason and stays", async () => {
    leaveOrganization.mockResolvedValue(fail("E_LAST_ADMIN"));
    render(<LeaveOrganization orgId={ORG} orgName="DUET CSE" />);
    fireEvent.click(screen.getByRole("button", { name: "Leave organization" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Leave DUET CSE?" })).getByRole("button", { name: "Leave" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("An organization must keep at least one admin."));
    expect(push).not.toHaveBeenCalled();
  });
});

describe("OrgSettingsForm", () => {
  const org = { id: ORG, name: "DUET CSE", slug: "duet-cse", kind: "club" as const };

  it("starts with the saved values and a read-only URL name", () => {
    render(<OrgSettingsForm org={org} />);
    expect(screen.getByLabelText(/^Name/)).toHaveValue("DUET CSE");
    expect(screen.getByLabelText(/^Type/)).toHaveValue("club");
    expect(screen.getByLabelText("URL name")).toBeDisabled();
  });

  it("saves a new name and type", async () => {
    updateOrganization.mockResolvedValue(ok());
    render(<OrgSettingsForm org={org} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "DUET Computer Club" } });
    fireEvent.change(screen.getByLabelText(/^Type/), { target: { value: "university_program" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Organization updated"));
    expect(updateOrganization).toHaveBeenCalledWith({ orgId: ORG, name: "DUET Computer Club", kind: "university_program" });
    expect(refresh).toHaveBeenCalled();
  });

  it("refuses a one-letter name without calling the action", () => {
    render(<OrgSettingsForm org={org} />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "D" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Use at least 2 characters.")).toBeInTheDocument();
    expect(updateOrganization).not.toHaveBeenCalled();
  });
});

describe("updateOrganizationSchema", () => {
  it("is strict: no slug, no extra keys", () => {
    expect(updateOrganizationSchema.safeParse({ orgId: ORG, name: "Ok name", kind: "club" }).success).toBe(true);
    expect(updateOrganizationSchema.safeParse({ orgId: ORG, name: "Ok name", kind: "club", slug: "new-slug" }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ orgId: ORG, name: "Ok name", kind: "nope" }).success).toBe(false);
  });
});
