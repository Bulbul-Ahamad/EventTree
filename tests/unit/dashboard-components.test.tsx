import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MyEvents } from "@/features/dashboard/components/my-events";
import { MyTasks } from "@/features/dashboard/components/my-tasks";
import { ReviewQueue } from "@/features/dashboard/components/review-queue";
import type { MyTask, MyTaskGroups } from "@/features/dashboard/grouping";
import type { MyEvent, ReviewItem } from "@/features/dashboard/queries";
import { formatOverdue, formatRelative } from "@/lib/format-date";

const NOW = new Date("2026-10-31T06:00:00.000Z");
const H = 3600_000;
const D = 24 * H;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe("formatRelative", () => {
  it("speaks in minutes, hours and days, past and future", () => {
    expect(formatRelative(at(10_000), NOW)).toBe("just now");
    expect(formatRelative(at(-5 * 60_000), NOW)).toBe("5 minutes ago");
    expect(formatRelative(at(3 * H), NOW)).toBe("in 3 hours");
    expect(formatRelative(at(-2 * D), NOW)).toBe("2 days ago");
    expect(formatRelative(at(2 * D), NOW)).toBe("in 2 days");
  });

  it("uses words for yesterday and tomorrow", () => {
    expect(formatRelative(at(D), NOW)).toBe("tomorrow");
    expect(formatRelative(at(-D), NOW)).toBe("yesterday");
  });
});

describe("formatOverdue", () => {
  it("counts whole days, then hours, singular and plural", () => {
    expect(formatOverdue(at(-3 * D - H), NOW)).toBe("3 days overdue");
    expect(formatOverdue(at(-D), NOW)).toBe("1 day overdue");
    expect(formatOverdue(at(-5 * H), NOW)).toBe("5 hours overdue");
    expect(formatOverdue(at(-H), NOW)).toBe("1 hour overdue");
    expect(formatOverdue(at(-10 * 60_000), NOW)).toBe("Overdue");
  });
});

function task(id: string, over: Partial<MyTask> = {}): MyTask {
  return {
    nodeId: id,
    title: `Task ${id}`,
    status: "in_progress",
    priority: "medium",
    dueAt: null,
    eventId: "e1",
    eventTitle: "Tech Fest",
    eventStatus: "active",
    orgSlug: "acme",
    ...over,
  };
}

const EMPTY: MyTaskGroups = { overdue: [], dueThisWeek: [], later: [], noDueDate: [] };
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const ahead = (ms: number) => new Date(Date.now() + ms).toISOString();

describe("MyTasks", () => {
  it("shows the empty state without a call to action", () => {
    render(<MyTasks groups={EMPTY} />);
    expect(screen.getByText("Nothing assigned to you yet.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows only the groups that have tasks, in order, with counts", () => {
    render(<MyTasks groups={{ ...EMPTY, overdue: [task("a", { dueAt: ago(2 * D) })], noDueDate: [task("b"), task("c")] }} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(["Overdue (1)", "No due date (2)"]);
  });

  it("links each row to the node and shows event name and status badge", () => {
    render(<MyTasks groups={{ ...EMPTY, later: [task("n1", { status: "submitted" })] }} />);
    const link = screen.getByRole("link", { name: /Task n1/ });
    expect(link).toHaveAttribute("href", "/o/acme/events/e1?node=n1");
    expect(within(link).getByText("Tech Fest")).toBeInTheDocument();
    expect(within(link).getByText("Submitted")).toBeInTheDocument();
  });

  it("marks overdue rows with the overdue text", () => {
    render(<MyTasks groups={{ ...EMPTY, overdue: [task("o", { dueAt: ago(3 * D + H) })] }} />);
    expect(screen.getByText("3 days overdue")).toBeInTheDocument();
  });

  it("shows relative due text with the absolute date as title", () => {
    const due = ahead(2 * D + H);
    render(<MyTasks groups={{ ...EMPTY, dueThisWeek: [task("u", { dueAt: due })] }} />);
    const time = screen.getByText("Due in 2 days");
    expect(time.getAttribute("title")).toBeTruthy();
    expect(time).toHaveAttribute("datetime", due);
  });

  it("renders task titles as plain text", () => {
    const { container } = render(<MyTasks groups={{ ...EMPTY, noDueDate: [task("x", { title: "<b>bold</b>" })] }} />);
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("<b>bold</b>")).toBeInTheDocument();
  });
});

const REVIEW: ReviewItem = {
  nodeId: "n9",
  title: "Print banners",
  assigneeName: "Rafi Islam",
  submittedAt: ago(2 * D + H),
  eventId: "e1",
  eventTitle: "Tech Fest",
  orgSlug: "acme",
};

describe("ReviewQueue", () => {
  it("is hidden when there is nothing to review", () => {
    const { container } = render(<ReviewQueue items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists title, event, assignee and submitted time with a Review link", () => {
    render(<ReviewQueue items={[REVIEW, { ...REVIEW, nodeId: "n10", assigneeName: null }]} />);
    expect(screen.getByRole("heading", { name: /Needs my review/ })).toHaveTextContent("(2)");
    expect(screen.getByText("Tech Fest · Rafi Islam")).toBeInTheDocument();
    expect(screen.getByText("Tech Fest · Unassigned")).toBeInTheDocument();
    expect(screen.getAllByText("Submitted 2 days ago")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Review Print banners" })[0]).toHaveAttribute(
      "href",
      "/o/acme/events/e1?node=n9",
    );
  });
});

const EVENT: MyEvent = {
  id: "e1",
  title: "Tech Fest",
  orgName: "CSE Club",
  orgSlug: "acme",
  status: "active",
  progress: 60,
  role: "head",
};

describe("MyEvents", () => {
  it("shows title, org, status, progress and role, linking to the event", () => {
    render(<MyEvents events={[EVENT]} createHref="/o/acme/events/new" />);
    expect(screen.getByRole("link", { name: "Tech Fest" })).toHaveAttribute("href", "/o/acme/events/e1");
    expect(screen.getByText("CSE Club")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Tech Fest progress" })).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText("Head")).toBeInTheDocument();
  });

  it("empty state offers Create event for the last organization", () => {
    render(<MyEvents events={[]} createHref="/o/acme/events/new" />);
    expect(screen.getByText("You're not part of any event yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create event" })).toHaveAttribute("href", "/o/acme/events/new");
  });

  it("empty state without any organization has no button", () => {
    render(<MyEvents events={[]} createHref={null} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
