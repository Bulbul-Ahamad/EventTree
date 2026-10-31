import { cookies } from "next/headers";
import { LAST_ORG_COOKIE, pickOrgSlug } from "@/components/shell/nav-items";
import { MyEvents } from "@/features/dashboard/components/my-events";
import { MyTasks } from "@/features/dashboard/components/my-tasks";
import { ReviewQueue } from "@/features/dashboard/components/review-queue";
import { getMyEvents, getMyTasks, getReviewQueue } from "@/features/dashboard/queries";
import { listMyOrgs } from "@/features/orgs/queries";

// S08 (02_AppFlow): needs my review, my tasks, my events. All three reads are
// scoped by RLS and the self-verify rule in the database.
export default async function DashboardPage() {
  const [review, tasks, events, orgs, jar] = await Promise.all([
    getReviewQueue(),
    getMyTasks(),
    getMyEvents(),
    listMyOrgs(),
    cookies(),
  ]);
  const lastOrg = pickOrgSlug(
    orgs.map((o) => o.slug),
    jar.get(LAST_ORG_COOKIE)?.value,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-6">
      <h1 className="text-balance text-2xl font-bold md:text-3xl">Dashboard</h1>
      <ReviewQueue items={review} />
      <MyTasks groups={tasks} />
      <MyEvents events={events} createHref={lastOrg ? `/o/${encodeURIComponent(lastOrg)}/events/new` : null} />
    </div>
  );
}
