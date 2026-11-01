import { notFound } from "next/navigation";
import { JoinCodePanel } from "@/features/orgs/components/join-code-panel";
import { LeaveOrganization } from "@/features/orgs/components/leave-organization";
import { MembersList } from "@/features/orgs/components/members-list";
import { getCurrentUserId, getOrgBySlug, listOrgMembers } from "@/features/orgs/queries";

// S15 (02_AppFlow): everyone in the organization sees the list; admins also get
// role changes, Remove and the join code. Everyone may leave.
export default async function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();
  const [members, viewerId] = await Promise.all([listOrgMembers(org.id), getCurrentUserId()]);
  if (!viewerId) notFound();
  const isAdmin = org.role === "admin";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-bold md:text-3xl">Members</h1>
        <p className="break-words text-sm text-foreground-muted">
          {members.length} {members.length === 1 ? "person" : "people"} in {org.name}
        </p>
      </div>
      {isAdmin && org.joinCode ? <JoinCodePanel orgId={org.id} joinCode={org.joinCode} /> : null}
      <MembersList orgId={org.id} members={members} viewerId={viewerId} viewerIsAdmin={isAdmin} />
      <LeaveOrganization orgId={org.id} orgName={org.name} />
    </div>
  );
}
