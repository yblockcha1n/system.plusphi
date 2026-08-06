import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateWorkspace } from "@/lib/revalidate";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { projectFormSchema } from "@/features/projects/schema";
import type { SessionPayload } from "@/lib/session";

export async function saveProject(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = projectFormSchema.safeParse({
    id: idField(input),
    name: textField(input, "name"),
    description: textField(input, "description"),
    color: textField(input, "color"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, name, description, color } = parsed.data;

  const { error } = id
    ? await supabase.from("projects").update({ name, description, color }).eq("id", id)
    : await supabase
        .from("projects")
        .insert({ name, description, color, created_by: session.email });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return {
    status: "success",
    message: id ? "プロジェクトを更新しました。" : "プロジェクトを作成しました。",
  };
}

/**
 * プロジェクトを削除する。tasks.project_id / events.project_id は ON DELETE SET NULL
 * なので、ぶら下がっていたタスクと予定は消えず「未分類」に移る。
 */
export async function deleteProject(projectId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(projectId);
  if (!parsed.success) {
    return { status: "error", message: "不正なプロジェクトです。" };
  }

  const { error } = await supabase.from("projects").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return {
    status: "success",
    message: "プロジェクトを削除しました。中のタスクと予定は未分類に移動しました。",
  };
}

/** 完了したプロジェクトを閉じる / 戻す。削除と違いデータはそのまま残る。 */
export async function setProjectArchived(
  projectId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), archived: z.boolean() }).safeParse({
    id: projectId,
    archived: (input as { archived?: unknown })?.archived,
  });

  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: parsed.data.archived ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return {
    status: "success",
    message: parsed.data.archived
      ? "プロジェクトを完了にしました。"
      : "プロジェクトを進行中に戻しました。",
  };
}

/** ドラッグ&ドロップ後の並び順を保存する。 */
export async function reorderProjects(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("projects", input);

  if (result.status === "success") {
    revalidateWorkspace();
  }

  return result;
}
