import type { TaskRow } from "@/server/tasks";

export const STATUS_LABEL: Record<TaskRow["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABEL: Record<TaskRow["priority"], string> = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export const PRIORITY_TONE = { low: "outline", medium: "default", high: "warning", urgent: "danger" } as const;

export const STATUS_TONE = { todo: "default", in_progress: "info", blocked: "danger", done: "success", cancelled: "outline" } as const;
