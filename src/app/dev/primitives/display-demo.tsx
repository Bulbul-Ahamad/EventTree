"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { EventStatusBadge, PriorityLabel, RoleChip, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton, TreeSkeleton } from "@/components/ui/skeleton";

// Temporary visual check for step 3.01 (display primitives). Dev only.
export function DisplayDemo() {
  const [tab, setTab] = useState("active");
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Status, event status, role, priority</h3>
        <div className="flex flex-wrap gap-2">
          {(["todo", "in_progress", "submitted", "verified"] as const).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["draft", "active", "completed", "archived"] as const).map((s) => (
            <EventStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <RoleChip role="owner" />
          <RoleChip role="head" />
          <RoleChip role="assignee" />
          {(["low", "medium", "high", "urgent"] as const).map((p) => (
            <PriorityLabel key={p} priority={p} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Progress (tree 8 px, header 12 px)</h3>
        <ProgressBar value={0} label="Zero" />
        <ProgressBar value={42} label="Forty-two" />
        <ProgressBar value={99} label="Almost" />
        <ProgressBar value={100} label="Done" />
        <ProgressBar value={67} size="header" label="Event" />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <h3 className="w-full text-sm font-semibold">Avatars</h3>
        <Avatar id="1" name="Bulbul Ahamad" size="sm" />
        <Avatar id="2" name="Rafi Khan" />
        <Avatar id="3" name="বুলবুল আহমাদ" size="lg" />
        <Avatar id="4" name="Nadia" />
        <Avatar id="5" name="Imran Hossain" />
        <Avatar id="6" name="Tania Islam" />
        <Avatar id="7" name="Sakib" />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Tabs / segmented</h3>
        <SegmentedControl
          aria-label="Event tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Active", count: 3 },
            { value: "completed", label: "Completed" },
            { value: "archived", label: "Archived" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Banners</h3>
        <Banner variant="draft">Draft: only you can see changes taking shape. Activate to start tracking.</Banner>
        <Banner variant="readonly">This event is completed and read-only.</Banner>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Skeletons</h3>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="size-10 rounded-full" />
        <TreeSkeleton />
      </section>

      <section className="rounded-lg border border-border">
        <EmptyState
          icon={Inbox}
          title="Nothing assigned to you yet."
          description="When someone assigns you a task it will show up here."
          action={<Button>Create event</Button>}
        />
      </section>
    </div>
  );
}
