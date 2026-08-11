import { z } from "zod";
import { optionalEmail, optionalText, optionalUuid } from "@/lib/form";
import { fromDateTimeInput } from "@/lib/datetime";
import type { ProjectColor } from "@/features/projects/schema";

export const TASK_STATUSES = ["todo", "doing", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "未着手",
  doing: "進行中",
  review: "検収待ち",
  done: "完了",
};

/** 一覧のバッジ。配色はモノクロのまま濃淡だけで区別する。 */
export const TASK_STATUS_BADGE: Record<TaskStatus, string> = {
  todo: "border-border bg-transparent text-muted-foreground",
  doing: "border-foreground bg-foreground text-background",
  review: "border-border bg-muted text-foreground",
  done: "border-border bg-transparent text-muted-foreground line-through",
};

export function toTaskStatus(value: string | null | undefined): TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus) ? (value as TaskStatus) : "todo";
}

/**
 * datetime-local の値を JST として解釈して Date にする任意項目。
 * ブラウザのタイムゾーンでは解釈しない（lib/datetime.ts の方針）。
 */
const optionalDateTime = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || fromDateTimeInput(value) !== null, {
    message: "日時の形式が不正です",
  })
  .transform((value) => (value === null ? null : fromDateTimeInput(value)));

export const taskFormSchema = z
  .object({
    id: z.uuid().optional(),
    projectId: optionalUuid,
    /** マスタ（task_types）の id。未選択は null。 */
    taskTypeId: optionalUuid,
    title: z.string().trim().min(1, "タイトルは必須です").max(200),
    detail: optionalText(4000),
    status: z.enum(TASK_STATUSES).catch("todo"),
    startsAt: optionalDateTime,
    endsAt: optionalDateTime,
    deadlineAt: optionalDateTime,
    assignee: optionalEmail,
    reviewer: optionalEmail,
  })
  .refine(
    (value) =>
      value.startsAt === null ||
      value.endsAt === null ||
      value.endsAt.getTime() >= value.startsAt.getTime(),
    { message: "終了日時は開始日時より後にしてください", path: ["endsAt"] }
  );

export type TaskFormInput = z.input<typeof taskFormSchema>;

/** 一覧・カレンダーに渡す DTO。 */
export type TaskItem = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: ProjectColor;
  /** 種別。マスタから引いた名前で、未設定なら null。 */
  taskTypeId: string | null;
  taskTypeName: string | null;
  title: string;
  detail: string | null;
  status: TaskStatus;
  /** ISO 文字列。クライアントで new Date() して lib/datetime.ts の関数に渡す。 */
  startsAt: string | null;
  endsAt: string | null;
  deadlineAt: string | null;
  /** 担当者・検収者のメールアドレスと表示名。 */
  assignee: string | null;
  assigneeName: string | null;
  reviewer: string | null;
  reviewerName: string | null;
  sortOrder: number;
  createdBy: string | null;
  updatedAt: string;
};

export const TASK_SCOPES = ["all", "mine", "review"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

export const TASK_SCOPE_LABELS: Record<TaskScope, string> = {
  all: "すべて",
  mine: "自分の担当",
  review: "自分が検収",
};

export function toTaskScope(value: string | null | undefined): TaskScope {
  return TASK_SCOPES.includes(value as TaskScope) ? (value as TaskScope) : "all";
}
