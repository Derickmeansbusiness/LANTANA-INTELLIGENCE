import { z } from "zod";
import { optionalDate, optionalText, optionalUuid } from "./common";

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const RECURRENCES = [
  { value: "", label: "Doesn't repeat" },
  { value: "FREQ=DAILY", label: "Every day" },
  { value: "FREQ=WEEKLY", label: "Every week" },
  { value: "FREQ=WEEKLY;INTERVAL=2", label: "Every 2 weeks" },
  { value: "FREQ=MONTHLY", label: "Every month" },
  { value: "FREQ=MONTHLY;INTERVAL=3", label: "Every quarter" },
  { value: "FREQ=YEARLY", label: "Every year" },
] as const;

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title").max(300),
  description: optionalText(5000),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(PRIORITIES).default("medium"),
  due_date: optionalDate,
  assignee_id: optionalUuid,
  project_id: optionalUuid,
  milestone_id: optionalUuid,
  deal_id: optionalUuid,
  organization_id: optionalUuid,
  recurrence_rule: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;INTERVAL=[1-9][0-9]?)?$/, "Pick a repeat option").nullable().optional(),
  ),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name the project").max(200),
  description: optionalText(4000),
  deal_id: optionalUuid,
  owner_id: optionalUuid,
  status: z.enum(["planned", "active", "on_hold", "done"]).default("active"),
  start_date: optionalDate,
  target_date: optionalDate,
});

export const milestoneSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().trim().min(2, "Name the milestone").max(200),
  due_date: optionalDate,
});
