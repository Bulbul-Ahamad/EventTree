"use client";

import { UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Tooltip } from "@/components/ui/tooltip";
import { removeMember, setMemberRole } from "@/features/orgs/actions";
import type { OrgMember, OrgRole } from "@/features/orgs/queries";
import { formatDate } from "@/lib/format-date";
import { notify } from "@/lib/toast";

// S15 table. Admins get a role select and Remove on every other member;
// everyone else sees the list only. The database enforces who may do what
// (and E_LAST_ADMIN, E_OWNS_EVENTS); the messages from it are shown as toasts.
type Props = { orgId: string; members: OrgMember[]; viewerId: string; viewerIsAdmin: boolean };

export function MembersList({ orgId, members, viewerId, viewerIsAdmin }: Props) {
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [removePending, startRemove] = useTransition();
  const router = useRouter();

  function confirmRemove(member: OrgMember) {
    startRemove(async () => {
      const result = await removeMember({ orgId, userId: member.userId });
      if (result.ok) {
        notify.success(`${member.fullName} was removed`);
        setRemoving(null);
        router.refresh();
        return;
      }
      setRemoving(null);
      notify.error(result.message);
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Members of this organization</caption>
          <thead className="border-b border-border bg-surface-muted text-xs text-foreground-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium md:px-4">
                Member
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell md:px-4">
                Phone
              </th>
              <th scope="col" className="px-3 py-2 font-medium md:px-4">
                Role
              </th>
              <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell md:px-4">
                Joined
              </th>
              {viewerIsAdmin ? (
                <th scope="col" className="px-3 py-2 md:px-4">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <MemberRow
                key={m.userId}
                member={m}
                orgId={orgId}
                isSelf={m.userId === viewerId}
                viewerIsAdmin={viewerIsAdmin}
                onRemove={setRemoving}
              />
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing ? `Remove ${removing.fullName}?` : "Remove member?"}
        description="They lose access to this organization and are taken off every segment and task they were assigned to. They can join again with the join code."
        confirmLabel="Remove"
        destructive
        loading={removePending}
        onConfirm={() => removing && confirmRemove(removing)}
      />
    </>
  );
}

function MemberRow({
  member,
  orgId,
  isSelf,
  viewerIsAdmin,
  onRemove,
}: {
  member: OrgMember;
  orgId: string;
  isSelf: boolean;
  viewerIsAdmin: boolean;
  onRemove: (m: OrgMember) => void;
}) {
  const router = useRouter();
  // The select shows the new role at once and goes back by itself if the change fails.
  const [role, setRole] = useOptimistic<OrgRole, OrgRole>(member.role, (_, next) => next);
  const [pending, startTransition] = useTransition();

  function changeRole(next: OrgRole) {
    startTransition(async () => {
      setRole(next);
      const result = await setMemberRole({ orgId, userId: member.userId, role: next });
      if (result.ok) {
        notify.success(`${member.fullName} is now ${next === "admin" ? "an admin" : "a member"}`);
        router.refresh();
      } else {
        notify.error(result.message);
      }
    });
  }

  return (
    <tr aria-busy={pending || undefined}>
      {/* w-full + max-w-0: this column takes the free width and lets long names truncate instead of widening the table. */}
      <td className="w-full max-w-0 px-3 py-3 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar id={member.userId} name={member.fullName} size="md" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {member.fullName}
              {isSelf ? <span className="font-normal text-foreground-muted"> (you)</span> : null}
            </span>
            <span className="truncate text-xs text-foreground-muted">{member.email}</span>
            {/* Below sm the phone column is hidden, so the number sits here instead. */}
            {member.phone ? (
              <span className="truncate text-xs text-foreground-muted sm:hidden">{member.phone}</span>
            ) : null}
          </div>
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-3 py-3 text-foreground-muted sm:table-cell md:px-4">
        {member.phone ?? "Not added"}
      </td>
      <td className="px-3 py-3 md:px-4">
        {viewerIsAdmin ? (
          <NativeSelect
            aria-label={`Role of ${member.fullName}`}
            value={role}
            disabled={pending}
            onChange={(e) => changeRole(e.target.value as OrgRole)}
            className="w-32"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </NativeSelect>
        ) : (
          <Badge className="bg-surface-muted text-foreground">{member.role === "admin" ? "Admin" : "Member"}</Badge>
        )}
      </td>
      <td className="hidden px-3 py-3 text-foreground-muted sm:table-cell md:px-4">{formatDate(member.joinedAt)}</td>
      {viewerIsAdmin ? (
        <td className="px-3 py-3 text-right md:px-4">
          {isSelf ? null : (
            <Tooltip content="Remove from organization">
              <Button variant="ghost" size="icon" aria-label={`Remove ${member.fullName}`} onClick={() => onRemove(member)}>
                <UserMinus aria-hidden className="text-danger" />
              </Button>
            </Tooltip>
          )}
        </td>
      ) : null}
    </tr>
  );
}
