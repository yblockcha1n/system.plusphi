import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { TaskTypeItem, TaskTypeOption } from "@/features/task-types/schema";

export const UNTYPED_LABEL = "種別なし";

/**
 * マスタ管理画面用。閉じたものも含めて全件を、利用件数つきで返す。
 *
 * 件数はタスク側から task_type_id だけを引いて数える。種別は数個で、
 * 数えたいのが「1 種別あたり 1 つの数値」だけなので、集計関数を足すより
 * この方が単純（プロジェクトの集計と違い、タスク全件を運ぶわけではない）。
 */
export async function getTaskTypes(): Promise<TaskTypeItem[]> {
  await requireSession();

  const [typesResult, countsResult] = await Promise.all([
    supabase.from("task_types").select("*").order("sort_order").order("created_at"),
    supabase.from("tasks").select("task_type_id").not("task_type_id", "is", null),
  ]);

  if (typesResult.error) {
    throw new Error(`タスク種別の取得に失敗しました: ${typesResult.error.message}`);
  }
  if (countsResult.error) {
    throw new Error(`タスクの集計に失敗しました: ${countsResult.error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of countsResult.data) {
    const id = row.task_type_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return typesResult.data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdBy: displayName(row.created_by),
    taskCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * タスクのフォームに出す選択肢。閉じた種別は出さない。
 *
 * ただし編集中のタスクに既に付いている種別が閉じられていた場合、選択肢に無いと
 * 保存のたびに外れてしまう。呼び出し側で現在値を足せるよう、この関数は
 * 「今選べるもの」だけを返し、判断は画面側に委ねる。
 */
export async function getTaskTypeOptions(): Promise<TaskTypeOption[]> {
  await requireSession();

  const { data, error } = await supabase
    .from("task_types")
    .select("id, name, archived_at")
    .order("sort_order")
    .order("created_at");

  if (error) {
    throw new Error(`タスク種別の取得に失敗しました: ${error.message}`);
  }

  return data
    .filter((row) => row.archived_at === null)
    .map((row) => ({ id: row.id, name: row.name }));
}
