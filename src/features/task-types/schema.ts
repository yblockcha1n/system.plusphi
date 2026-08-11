import { z } from "zod";
import { optionalText } from "@/lib/form";

/**
 * タスク種別のマスタ。
 *
 * enum やアプリ側の定数にしていないのは、運用しながら画面から増減・改名したいため。
 * 種別を消してもタスクは残る（tasks.task_type_id は on delete set null）。
 */
export const taskTypeFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "種別名は必須です").max(60),
  description: optionalText(200),
});

export type TaskTypeFormInput = z.input<typeof taskTypeFormSchema>;

/** 一覧・管理画面に渡す DTO。 */
export type TaskTypeItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** null = 利用中。 */
  archivedAt: string | null;
  createdBy: string | null;
  /** この種別が付いているタスクの件数。削除の影響を画面に出すために持つ。 */
  taskCount: number;
};

/** Select 用の最小情報。 */
export type TaskTypeOption = {
  id: string;
  name: string;
};
