import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateWorkspace } from "@/lib/revalidate";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { taskTypeFormSchema } from "@/features/task-types/schema";
import type { SessionPayload } from "@/lib/session";

const SETTINGS_PATH = "/settings/task-types";

/** マスタ画面と、種別を選ぶ画面（タスク一覧など）の両方を作り直す。 */
function revalidateAll(): void {
  revalidatePath(SETTINGS_PATH);
  revalidateWorkspace();
}

export async function saveTaskType(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = taskTypeFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    description: textField(input, "description"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, description } = parsed.data;

  const { error } = id
    ? await supabase.from("task_types").update({ name, description }).eq("id", id)
    : await supabase
        .from("task_types")
        .insert({ name, description, created_by: session.email });

  if (error) {
    // 23505 = unique_violation。名前の重複は利用者の入力ミスなので、専用の文言にする。
    if (error.code === "23505") {
      return {
        status: "error",
        message: "同じ名前の種別が既にあります。",
        fieldErrors: { name: ["この名前は使われています"] },
      };
    }

    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return { status: "success", message: id ? "種別を更新しました。" : "種別を追加しました。" };
}

/**
 * 種別を削除する。tasks.task_type_id は on delete set null なので、
 * 付いていたタスクは消えず「種別なし」になる。
 */
export async function deleteTaskType(taskTypeId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(taskTypeId);
  if (!parsed.success) {
    return { status: "error", message: "不正な種別です。" };
  }

  const { error } = await supabase.from("task_types").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: "種別を削除しました。付いていたタスクは種別なしになりました。",
  };
}

/**
 * 使わなくなった種別を選択肢から外す / 戻す。
 *
 * 削除と違い、既に付いているタスクの種別表示はそのまま残る。過去の記録を
 * 保ったまま新規登録では選ばせたくない、という場合はこちらを使う。
 */
export async function setTaskTypeArchived(
  taskTypeId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({
    id: taskTypeId,
    archived: (input as { archived?: unknown })?.archived,
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("task_types")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateAll();
  return {
    status: "success",
    message: parsed.data.archived
      ? "種別を選択肢から外しました。"
      : "種別を選べるように戻しました。",
  };
}

/** ドラッグ&ドロップ後の並び順を保存する。 */
export async function reorderTaskTypes(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("task_types", input);

  if (result.status === "success") {
    revalidateAll();
  }

  return result;
}
