import { fireEvent, render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Avatar, initialsOf, tintIndexOf } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import {
  EventStatusBadge,
  PriorityLabel,
  RoleChip,
  StatusBadge,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { clampPercent, ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TreeSkeleton } from "@/components/ui/skeleton";

describe("badges", () => {
  it("StatusBadge shows icon and label for every status, never colour alone", () => {
    for (const [status, label] of [
      ["todo", "To do"],
      ["in_progress", "In progress"],
      ["submitted", "Submitted"],
      ["verified", "Verified"],
    ] as const) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      unmount();
    }
  });

  it("EventStatusBadge uses the spec labels and palettes", () => {
    const { rerender } = render(<EventStatusBadge status="draft" />);
    expect(screen.getByText("Draft").className).toContain("bg-status-todo-bg");
    rerender(<EventStatusBadge status="active" />);
    expect(screen.getByText("Active").className).toContain("bg-status-in_progress-bg");
    rerender(<EventStatusBadge status="completed" />);
    expect(screen.getByText("Completed").className).toContain("bg-status-verified-bg");
    rerender(<EventStatusBadge status="archived" />);
    expect(screen.getByText("Archived").className).toContain("bg-status-todo-bg");
  });

  it("RoleChip and PriorityLabel render their labels", () => {
    render(
      <>
        <RoleChip role="owner" />
        <RoleChip role="head" />
        <RoleChip role="assignee" />
        <PriorityLabel priority="urgent" />
      </>,
    );
    expect(screen.getByText("Owner").className).toContain("bg-primary-soft");
    expect(screen.getByText("Head")).toBeInTheDocument();
    expect(screen.getByText("Assignee")).toBeInTheDocument();
    expect(screen.getByText("Urgent").className).toContain("text-priority-urgent");
  });
});

describe("ProgressBar", () => {
  it("exposes progressbar semantics and rounds the value", () => {
    render(<ProgressBar value={33.4} label="Venue progress" />);
    const bar = screen.getByRole("progressbar", { name: "Venue progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "33");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("clamps out-of-range and invalid values", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(250)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(99.6)).toBe(100);
  });

  it("turns green only at 100 %, and header size is taller", () => {
    const { container, rerender } = render(<ProgressBar value={99} label="p" />);
    expect(container.querySelector(".bg-primary")).not.toBeNull();
    rerender(<ProgressBar value={100} label="p" size="header" />);
    expect(container.querySelector(".bg-success")).not.toBeNull();
    expect(screen.getByRole("progressbar").className).toContain("h-3");
  });

  it("can hide the percent label", () => {
    render(<ProgressBar value={50} label="p" showLabel={false} />);
    expect(screen.queryByText("50%")).toBeNull();
  });
});

describe("Avatar", () => {
  it("takes the first letters of the first two words, Bangla-safe", () => {
    expect(initialsOf("Bulbul Ahamad Khan")).toBe("BA");
    expect(initialsOf("  rafi  ")).toBe("R");
    expect(initialsOf("বুলবুল আহমাদ")).toBe("বআ");
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
  });

  it("does not split an emoji or surrogate pair", () => {
    expect(Array.from(initialsOf("😀 Smile"))).toHaveLength(2);
  });

  it("gives the same tint for the same id, always one of six", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const t = tintIndexOf(`user-${i}`);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(6);
      seen.add(t);
    }
    expect(seen.size).toBe(6);
    expect(tintIndexOf("abc")).toBe(tintIndexOf("abc"));
  });

  it("is decorative unless labelled", () => {
    const { rerender, container } = render(<Avatar id="u1" name="Ada Lovelace" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    rerender(<Avatar id="u1" name="Ada Lovelace" aria-label="Ada Lovelace" />);
    expect(screen.getByRole("img", { name: "Ada Lovelace" })).toHaveTextContent("AL");
  });
});

describe("Skeleton, EmptyState, Banner", () => {
  it("TreeSkeleton renders 8 rows and announces loading", () => {
    render(<TreeSkeleton />);
    const status = screen.getByRole("status", { name: "Loading" });
    expect(status.children).toHaveLength(8);
  });

  it("EmptyState shows title, body and an optional single action", () => {
    const { rerender } = render(<EmptyState icon={Inbox} title="No events yet" description="Create one." />);
    expect(screen.getByRole("heading", { name: "No events yet" })).toBeInTheDocument();
    expect(screen.getByText("Create one.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<EmptyState icon={Inbox} title="No events yet" action={<button>Create</button>} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("Banner uses the draft and read-only colours", () => {
    const { rerender } = render(<Banner variant="draft">Draft event</Banner>);
    expect(screen.getByRole("status").className).toContain("bg-info-soft");
    rerender(<Banner variant="readonly">Read only</Banner>);
    expect(screen.getByRole("status").className).toContain("bg-warning-soft");
  });
});

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("a");
  return (
    <SegmentedControl
      aria-label="Tabs"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      options={[
        { value: "a", label: "Active", count: 3 },
        { value: "b", label: "Completed" },
        { value: "c", label: "Archived" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("marks the selected tab and uses a roving tabindex", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Tabs" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Active/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /Active/ })).toHaveAttribute("tabindex", "0");
  });

  it("changes on click and shows counts", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Completed" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves with arrow keys, wraps around, and Home/End jump", () => {
    render(<Harness />);
    const active = screen.getByRole("tab", { name: /Active/ });
    fireEvent.keyDown(active, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Completed" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Archived" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Archived" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Active/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: /Active/ }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Archived" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Archived" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Active/ })).toHaveAttribute("aria-selected", "true");
  });
});
