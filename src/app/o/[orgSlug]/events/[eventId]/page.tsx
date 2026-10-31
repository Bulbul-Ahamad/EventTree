import { notFound } from "next/navigation";
import { z } from "zod";
import { EventTree } from "@/components/tree/event-tree";
import { EventHeader } from "@/features/events/components/event-header";
import { getEvent, getEventContext } from "@/features/events/queries";
import { getEventTree } from "@/features/nodes/queries";
import { listOrgMembers } from "@/features/orgs/queries";
import { getNodeActivity } from "@/features/updates/queries";
import { id as guid } from "@/lib/zod-common";
import { isEventOwner } from "@/lib/permissions";
import { walk } from "@/lib/tree";

// S11 (02_AppFlow) with the S12 detail panel driven by ?node=.
// 404 when the event does not exist or I cannot see it.
export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; eventId: string }>;
  searchParams: Promise<{ node?: string | string[] }>;
}) {
  const { orgSlug, eventId } = await params;
  // Only a well-formed id reaches the database; anything else is handled by the client.
  const nodeParam = z.object({ node: guid }).safeParse(await searchParams);
  const nodeId = nodeParam.success ? nodeParam.data.node : null;
  const [event, root, ctx, activity] = await Promise.all([
    getEvent(eventId),
    getEventTree(eventId),
    getEventContext(eventId),
    nodeId ? getNodeActivity(nodeId) : Promise.resolve([]),
  ]);
  if (!event || !root || !ctx) notFound();

  const members = (await listOrgMembers(event.orgId)).map((m) => ({
    value: m.userId,
    label: m.fullName,
    description: m.email,
  }));
  const unassignedCount = walk(root).filter((n) => n.assignee_id === null).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <EventHeader
        event={event}
        isOwner={isEventOwner(ctx)}
        unassignedCount={unassignedCount}
        settingsHref={`/o/${encodeURIComponent(orgSlug)}/events/${eventId}/settings`}
      />
      <EventTree root={root} ctx={ctx} members={members} activity={activity} activityFor={nodeId} />
    </div>
  );
}
