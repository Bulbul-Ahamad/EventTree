import { z } from "zod";
import { id } from "@/lib/zod-common";

// 02_AppFlow S07 and 05_Schema §3.2.
export const ORG_KINDS = ["club", "organization", "university_program", "other"] as const;
export type OrgKind = (typeof ORG_KINDS)[number];

export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  club: "Club",
  organization: "Organization",
  university_program: "University program",
  other: "Other",
};

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(2, "Use at least 2 characters.").max(100, "Use at most 100 characters."),
    slug: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(48, "Use at most 48 characters.")
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
    kind: z.enum(ORG_KINDS),
  })
  .strict();

// Codes are shown upper-case; spaces are ignored. Whether a code exists is
// decided only by the database (generic error, TRD §8.10).
export const joinOrganizationSchema = z
  .object({
    code: z
      .string()
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().min(1, "Enter a code.").max(64, "Invalid or expired code.")),
  })
  .strict();

// Member management (S15). Authority is enforced by the RPCs.
const orgId = id;
const userId = id;

export const rotateJoinCodeSchema = z.object({ orgId }).strict();
export const setMemberRoleSchema = z
  .object({ orgId, userId, role: z.enum(["admin", "member"]) })
  .strict();
export const removeMemberSchema = z.object({ orgId, userId }).strict();

export const leaveOrganizationSchema = z.object({ orgId }).strict();
