"use client";

import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

const PEOPLE = [
  { value: "1", label: "Bulbul Ahamad", description: "bulbul@demo.test" },
  { value: "2", label: "Rafi Khan", description: "rafi@demo.test" },
  { value: "3", label: "Nadia Islam", description: "nadia@demo.test" },
  { value: "4", label: "বুলবুল আহমাদ", description: "bangla@demo.test" },
  { value: "5", label: "Imran Hossain", description: "imran@demo.test" },
  { value: "6", label: "Tania Akter", description: "tania@demo.test" },
  { value: "7", label: "Sakib Hasan", description: "sakib@demo.test" },
];

// Temporary visual check for step 3.01 (overlay primitives). Dev only.
export function OverlayDemo() {
  const [who, setWho] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap items-start gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Dialog</Button>
          </DialogTrigger>
          <DialogContent size="form">
            <DialogHeader>
              <DialogTitle>Rename segment</DialogTitle>
              <DialogDescription>Short and clear works best.</DialogDescription>
            </DialogHeader>
            <Input defaultValue="Publicity" aria-label="Segment name" />
            <DialogFooter>
              <Button variant="secondary">Cancel</Button>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Detail sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Book the venue</SheetTitle>
              <SheetDescription>Task · Publicity</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <p className="text-sm text-foreground-muted">Right drawer from md up, full-screen sheet below md.</p>
            </SheetBody>
          </SheetContent>
        </Sheet>

        <Button variant="destructive" onClick={() => setConfirm(true)}>
          Confirm dialog
        </Button>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this segment?"
          description="Everything inside it is deleted too. This cannot be undone."
          confirmLabel="Delete"
          destructive
          loading={loading}
          onConfirm={() => {
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              setConfirm(false);
            }, 1500);
          }}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Row actions">
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 aria-hidden /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Mark verified">
          <Button variant="ghost" size="icon" aria-label="Verify">
            ✓
          </Button>
        </Tooltip>
      </div>

      <div className="max-w-sm">
        <Combobox
          options={PEOPLE}
          value={who}
          onChange={setWho}
          placeholder="Assign to…"
          searchPlaceholder="Search people"
          clearLabel="Unassigned"
        />
      </div>
    </TooltipProvider>
  );
}
