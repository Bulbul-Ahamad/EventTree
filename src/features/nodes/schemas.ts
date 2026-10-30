import { z } from "zod";
import { id, isoDateTime, nullableText, requiredText } from "@/lib/zod-common";

// 01_PRD US-05/06 and 05_Schema §3.4. Weight 1-10, depth/limits are DB rules.
export const NODE_CREATE_TYPES = ["segment", "task"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const title = requiredText(200, "Enter a title.");
const weight = z
  .number()
  .int("Use a whole number.")
  .min(1, "Use a number from 1 to 10.")
  .max(10, "Use a number from 1 to 10.");

export const createNodeSchema = z
  .object({
    parentId: id,
    type: z.enum(NODE_CREATE_TYPES),
    title,
    description: nullableText(5000),
    assigneeId: id.nullish(),
    dueAt: isoDateTime.nullish(),
    priority: z.enum(PRIORITIES).default("medium"),
    weight: weight.default(1),
  })
  .strict();

// Edit fields only; type, parent and assignee are not editable here.
export const updateNodeSchema = z
  .object({
    nodeId: id,
    title: title.optional(),
    description: nullableText(5000),
    dueAt: isoDateTime.nullish(),
    priority: z.enum(PRIORITIES).optional(),
    weight: weight.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.dueAt !== undefined ||
      v.priority !== undefined ||
      v.weight !== undefined,
    { message: "Nothing to update." },
  );

export const reassignNodeSchema = z
  .object({ nodeId: id, assigneeId: id.nullable() })
  .strict();

export const deleteNodeSchema = z.object({ nodeId: id }).strict();
