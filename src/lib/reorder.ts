import "server-only";
import { supabase } from "@/lib/supabase";
import { orderedIds, type ActionState } from "@/lib/form";

/** sort_order を持つテーブル。DB 関数側のホワイトリストと揃えること。 */
type ReorderTable =
  | "sections"
  | "projects"
  | "tasks"
  | "task_types"
  | "inspiration_tags";

/**
 * ドラッグ&ドロップ後の並び順を保存する。渡された配列の順に sort_order を振り直す。
 *
 * id ごとに UPDATE を投げるのではなく、1 本の UPDATE にまとめた DB 関数
 * （0004 の reorder_records）を呼ぶ。個別に投げると途中で失敗したときに
 * 「一部だけ新しい順序」という中途半端な状態が残ってしまうため。
 *
 * revalidate は呼び出し側の責務。画面ごとに作り直す範囲が違う。
 */
export async function reorderRecords(
  table: ReorderTable,
  input: unknown
): Promise<ActionState> {
  const parsed = orderedIds.safeParse((input as { ids?: unknown })?.ids);
  if (!parsed.success) {
    return { status: "error", message: "並び順の指定が不正です。" };
  }

  const { error } = await supabase.rpc("reorder_records", {
    p_table: table,
    p_ids: parsed.data,
  });

  if (error) {
    return { status: "error", message: `並び順の保存に失敗しました: ${error.message}` };
  }

  return { status: "success", message: "並び順を保存しました。" };
}
