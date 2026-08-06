import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateWorkspace } from "@/lib/revalidate";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { TASK_STATUSES, taskFormSchema } from "@/features/tasks/schema";
import type { SessionPayload } from "@/lib/session";

const toIso = (date: Date | null) => (date ? date.toISOString() : null);

export async function saveTask(session: SessionPayload, input: unknown): Promise<ActionState> {
  const parsed = taskFormSchema.safeParse({
    id: idField(input),
    projectId: textField(input, "projectId"),
    title: textField(input, "title"),
    detail: textField(input, "detail"),
    status: textField(input, "status"),
    startsAt: textField(input, "startsAt"),
    endsAt: textField(input, "endsAt"),
    deadlineAt: textField(input, "deadlineAt"),
    assignee: textField(input, "assignee"),
    reviewer: textField(input, "reviewer"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, projectId, title, detail, status, startsAt, endsAt, deadlineAt, assignee, reviewer } =
    parsed.data;

  const values = {
    project_id: projectId,
    title,
    detail,
    status,
    starts_at: toIso(startsAt),
    ends_at: toIso(endsAt),
    deadline_at: toIso(deadlineAt),
    assignee,
    reviewer,
  };

  const { error } = id
    ? await supabase.from("tasks").update(values).eq("id", id)
    : // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
      await supabase.from("tasks").insert({ ...values, created_by: session.email });

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: id ? "タスクを更新しました。" : "タスクを登録しました。" };
}

export async function deleteTask(taskId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(taskId);
  if (!parsed.success) {
    return { status: "error", message: "不正なタスクです。" };
  }

  const { error } = await supabase.from("tasks").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: "タスクを削除しました。" };
}

const statusSchema = z.object({
  taskId: z.uuid(),
  status: z.enum(TASK_STATUSES),
});

/** 一覧から状態だけを切り替える。編集シートを開かずに完了にできるようにするため。 */
export async function updateTaskStatus(taskId: string, input: unknown): Promise<ActionState> {
  const parsed = statusSchema.safeParse({ taskId, status: textField(input, "status") });
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.taskId);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  revalidateWorkspace();
  return { status: "success", message: "状態を更新しました。" };
}

export async function reorderTasks(input: unknown): Promise<ActionState> {
  const result = await reorderRecords("tasks", input);

  if (result.status === "success") {
    revalidateWorkspace();
  }

  return result;
}
