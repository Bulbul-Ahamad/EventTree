import { z } from "zod";
import { httpUrl, id, nullableText } from "@/lib/zod-common";

// 01_PRD US-10/11/14 and 05_Schema §3.7. Comments are plain text, <= 2000.
export const TASK_STATUSES = ["todo", "in_progress", "submitted", "verified"] as const;
const taskStatus = z.enum(TASK_STATUSES);

export const transitionTaskSchema = z
  .object({
    nodeId: id,
    from: taskStatus,
    to: taskStatus,
    comment: nullableText(2000),
  })
  .strict()
  .refine((v) => v.from !== v.to, { path: ["to"], message: "Choose a different status." });

export const addCommentSchema = z
  .object({
    nodeId: id,
    body: z.string().trim().min(1, "Write a comment.").max(2000, "Use at most 2000 characters."),
  })
  .strict();

export const addProofLinkSchema = z
  .object({ nodeId: id, url: httpUrl, note: nullableText(2000) })
  .strict();
