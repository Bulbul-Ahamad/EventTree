import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RelativeTime } from "@/components/ui/relative-time";
import type { MyTask, MyTaskGroups } from "@/features/dashboard/grouping";

const GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "dueThisWeek", label: "Due this week" },
  { key: "later", label: "Later" },
  { key: "noDueDate", label: "No due date" },
] as const satisfies ReadonlyArray<{ key: keyof MyTaskGroups; label: string }>;

// Same rule as grouping.ts: only active events can have overdue work.
function TaskRow({ task, overdue }: { task: MyTask; overdue: boolean }) {
  return (
    <li>
      <Link
        href={`/o/${encodeURIComponent(task.orgSlug)}/events/${task.eventId}?node=${task.nodeId}`}
        className="flex min-h-14 flex-col gap-1 px-4 py-3 transition-colors duration-150 hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-4"
      >
        {task.status ? <StatusBadge status={task.status} className="self-start" /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{task.title}</span>
          <span className="truncate text-sm text-foreground-muted">{task.eventTitle}</span>
        </div>
        {task.dueAt ? (
          <RelativeTime iso={task.dueAt} prefix="Due" overdue={overdue} className="text-sm text-foreground-muted" />
        ) : null}
      </Link>
    </li>
  );
}

// "My tasks" (02_AppFlow S08): Overdue / Due this week / Later / No due date.
export function MyTasks({ groups }: { groups: MyTaskGroups }) {
  const total = GROUPS.reduce((n, g) => n + groups[g.key].length, 0);
  return (
    <section aria-labelledby="my-tasks" className="flex flex-col gap-3">
      <h2 id="my-tasks" className="text-lg font-semibold">
        My tasks
      </h2>
      {total === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing assigned to you yet." />
      ) : (
        GROUPS.map(({ key, label }) =>
          groups[key].length === 0 ? null : (
            <div key={key} className="flex flex-col gap-2">
              <h3 className={key === "overdue" ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-foreground-muted"}>
                {label} ({groups[key].length})
              </h3>
              <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                {groups[key].map((t) => (
                  <TaskRow key={t.nodeId} task={t} overdue={key === "overdue"} />
                ))}
              </ul>
            </div>
          ),
        )
      )}
    </section>
  );
}
