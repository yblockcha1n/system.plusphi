import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateWorkspace } from "@/lib/revalidate";
import { reorderRecords } from "@/lib/reorder";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { TASK_STATUSES, taskFormSchema } from "@/features/tasks/schema";
import { notifyTaskAssigned, notifyTaskReview } from "@/features/push/notify";
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

  // 通知を出すかどうかは「変更前と比べて変わったか」で決まるので、先に控える。
  // 更新のたびに送ると、題名を直しただけで担当者に通知が飛んでしまう。
  const before = id ? await readNotifyState(id) : null;

  const { data, error } = id
    ? await supabase.from("tasks").update(values).eq("id", id).select("id").single()
    : // 登録者はセッションから取る。リクエストの値を信用すると詐称できてしまう。
      await supabase
        .from("tasks")
        .insert({ ...values, created_by: session.email })
        .select("id")
        .single();

  if (error) {
    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  notifyTaskAssigned({
    actor: session.email,
    assignee,
    previousAssignee: before?.assignee ?? null,
    taskId: data.id,
    title,
    deadlineAt: toIso(deadlineAt),
  });

  // 登録・編集の時点で「検収待ち」にされた場合も検収者へ知らせる
  if (status === "review" && before?.status !== "review") {
    notifyTaskReview({ actor: session.email, reviewer, taskId: data.id, title });
  }

  revalidateWorkspace();
  return { status: "success", message: id ? "タスクを更新しました。" : "タスクを登録しました。" };
}

/** 通知の要否を判断するために必要な、変更前の値だけを読む。 */
async function readNotifyState(
  taskId: string
): Promise<{ assignee: string | null; status: string } | null> {
  const { data } = await supabase
    .from("tasks")
    .select("assignee, status")
    .eq("id", taskId)
    .maybeSingle();

  return data ?? null;
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
export async function updateTaskStatus(
  session: SessionPayload,
  taskId: string,
  input: unknown
): Promise<ActionState> {
  const parsed = statusSchema.safeParse({ taskId, status: textField(input, "status") });
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  // 既に「検収待ち」のものを押し直したときに通知を重ねないよう、変更前を見る
  const { data: before } = await supabase
    .from("tasks")
    .select("status")
    .eq("id", parsed.data.taskId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.taskId)
    .select("id, title, reviewer")
    .single();

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  if (parsed.data.status === "review" && before?.status !== "review") {
    notifyTaskReview({
      actor: session.email,
      reviewer: data.reviewer,
      taskId: data.id,
      title: data.title,
    });
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
