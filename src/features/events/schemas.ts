import { z } from "zod";
import {
  END_BEFORE_START,
  endNotBeforeStart,
  id,
  isoDateTime,
  nullableText,
  requiredText,
} from "@/lib/zod-common";

// 01_PRD US-04 and 05_Schema §3.4-3.5.
export const REVIEW_MODES = ["assignee_submits", "head_only"] as const;
export const EVENT_STATUSES = ["draft", "active", "completed", "archived"] as const;

const eventFields = {
  title: requiredText(200, "Enter a title."),
  description: nullableText(5000),
  startsAt: isoDateTime.nullish(),
  endsAt: isoDateTime.nullish(),
  location: nullableText(200),
  reviewMode: z.enum(REVIEW_MODES).default("assignee_submits"),
};

export const createEventSchema = z
  .object({ orgId: id, ...eventFields })
  .strict()
  .refine(endNotBeforeStart, END_BEFORE_START);

export const updateEventSettingsSchema = z
  .object({ eventId: id, ...eventFields })
  .strict()
  .refine(endNotBeforeStart, END_BEFORE_START);

export const setEventStatusSchema = z
  .object({ eventId: id, to: z.enum(EVENT_STATUSES) })
  .strict();

export const deleteEventSchema = z.object({ eventId: id }).strict();
