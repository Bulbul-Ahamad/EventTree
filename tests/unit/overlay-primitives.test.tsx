import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Combobox, filterOptions, type ComboboxOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

describe("Dialog", () => {
  function Demo() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename event</DialogTitle>
            <DialogDescription>Pick a new name.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  it("opens with an accessible name and description, and closes with the X button", async () => {
    render(<Demo />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename event" });
    expect(dialog).toHaveAccessibleDescription("Pick a new name.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes on Escape", async () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Sheet", () => {
  it("renders a detail drawer with title and body", async () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Details</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Book venue</SheetTitle>
            <SheetDescription>Task details</SheetDescription>
          </SheetHeader>
          <SheetBody>Body text</SheetBody>
        </SheetContent>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    const sheet = await screen.findByRole("dialog", { name: "Book venue" });
    expect(sheet.className).toContain("md:w-[440px]");
    expect(within(sheet).getByText("Body text")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  function Demo({ onConfirm, loading = false }: { onConfirm: () => void; loading?: boolean }) {
    const [open, setOpen] = useState(true);
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this segment?"
        description="Everything inside it is deleted too."
        confirmLabel="Delete"
        destructive
        loading={loading}
        onConfirm={onConfirm}
      />
    );
  }

  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    render(<Demo onConfirm={onConfirm} />);
    const dialog = await screen.findByRole("dialog", { name: "Delete this segment?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed while loading and disables both buttons", async () => {
    render(<Demo onConfirm={() => {}} loading />);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveAttribute("aria-busy", "true");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("DropdownMenu", () => {
  it("opens from the keyboard and runs an item", async () => {
    const onEdit = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="Row actions">⋮</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Row actions" }), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Delete" }).className).toContain("text-danger");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("Tooltip", () => {
  it("shows on keyboard focus", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip content="Mark verified">
          <Button aria-label="Verify">✓</Button>
        </Tooltip>
      </TooltipProvider>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Mark verified");
  });
});

const PEOPLE: ComboboxOption[] = [
  { value: "1", label: "Bulbul Ahamad", description: "bulbul@demo.test" },
  { value: "2", label: "Rafi Khan", description: "rafi@demo.test" },
  { value: "3", label: "বুলবুল আহমাদ" },
];

describe("filterOptions", () => {
  it("is case-insensitive and searches label and description", () => {
    expect(filterOptions(PEOPLE, "RAFI").map((o) => o.value)).toEqual(["2"]);
    expect(filterOptions(PEOPLE, "demo.test").map((o) => o.value)).toEqual(["1", "2"]);
    expect(filterOptions(PEOPLE, "বুলবুল").map((o) => o.value)).toEqual(["3"]);
  });

  it("returns everything for an empty or blank query and nothing for no match", () => {
    expect(filterOptions(PEOPLE, "")).toHaveLength(3);
    expect(filterOptions(PEOPLE, "   ")).toHaveLength(3);
    expect(filterOptions(PEOPLE, "zzz")).toEqual([]);
  });
});

describe("Combobox", () => {
  function Demo({ onChange, initial = null }: { onChange?: (v: string | null) => void; initial?: string | null }) {
    const [v, setV] = useState<string | null>(initial);
    return (
      <Combobox
        options={PEOPLE}
        value={v}
        onChange={(next) => {
          setV(next);
          onChange?.(next);
        }}
        placeholder="Assignee"
        searchPlaceholder="Search people"
        clearLabel="Unassigned"
      />
    );
  }

  it("shows the placeholder, then the selected label", async () => {
    render(<Demo initial="2" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Rafi Khan");
  });

  it("filters while typing, selects with click and closes", async () => {
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const search = await screen.findByRole("searchbox", { name: "Search people" });
    fireEvent.change(search, { target: { value: "rafi" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith("2");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(screen.getByRole("combobox")).toHaveTextContent("Rafi Khan");
  });

  it("supports arrow keys and Enter, and wraps around", async () => {
    const onChange = vi.fn();
    render(<Demo onChange={onChange} />);
    fireEvent.click(screen.getByRole("combobox"));
    const search = await screen.findByRole("searchbox");
    // rows: Unassigned, Bulbul, Rafi, বুলবুল ; active starts at 0
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-2$/));
    fireEvent.keyDown(search, { key: "ArrowUp" });
    fireEvent.keyDown(search, { key: "ArrowUp" });
    fireEvent.keyDown(search, { key: "ArrowUp" }); // wraps to the last row
    expect(search).toHaveAttribute("aria-activedescendant", expect.stringMatching(/-3$/));
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("3");
  });

  it("can clear back to null with the clear row, and marks the selected option", async () => {
    const onChange = vi.fn();
    render(<Demo onChange={onChange} initial="1" />);
    fireEvent.click(screen.getByRole("combobox"));
    await screen.findByRole("listbox");
    expect(screen.getByRole("option", { name: /Bulbul Ahamad/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: "Unassigned" }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.getByRole("combobox")).toHaveTextContent("Assignee");
  });

  it("shows an empty message when nothing matches and exposes aria-expanded", async () => {
    render(<Demo />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    const search = await screen.findByRole("searchbox");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(search, { target: { value: "nobody" } });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" }); // nothing to choose: must not throw
  });

  it("passes aria props and disabled to the trigger", () => {
    render(<Combobox options={PEOPLE} value={null} onChange={() => {}} aria-invalid disabled id="who" />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toHaveAttribute("id", "who");
  });
});
