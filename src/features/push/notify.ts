import "server-only";
import { displayName } from "@/lib/env";
import { sendPushToUsers } from "@/lib/push";
import { formatDateTime } from "@/lib/datetime";
import type { PushPayload } from "@/features/push/schema";

/**
 * 業務上のできごとを通知へ変換する層。
 *
 * どの関数も「送れなくても業務処理は成功させる」方針で、例外を投げず待たせない。
 * タスクの保存が通知の失敗で巻き戻ったら本末転倒なので、呼び出し側は
 * `void notifyTaskAssigned(...)` のように投げっぱなしにしてよい。
 */

async function send(emails: (string | null)[], payload: PushPayload): Promise<void> {
  const targets = emails.filter((email): email is string => Boolean(email));

  if (targets.length === 0) return;

  try {
    await sendPushToUsers(targets, payload);
  } catch (cause) {
    console.error("[notify] 通知の送信に失敗しました", {
      kind: payload.kind,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  }
}

/** 締切を本文に添える。未設定なら何も足さない。 */
function deadlineSuffix(deadlineAt: string | null): string {
  return deadlineAt ? `・締切 ${formatDateTime(new Date(deadlineAt))}` : "";
}

/**
 * 自分が担当者に設定されたことを知らせる。
 *
 * 自分で自分を担当にしたときは送らない（自分の操作の結果が通知で返ってくるのは
 * 邪魔なだけ）。また、担当者が変わっていないときも送らないので、呼び出し側は
 * 変更前の担当者を渡すこと。
 */
export function notifyTaskAssigned(params: {
  actor: string;
  assignee: string | null;
  previousAssignee: string | null;
  taskId: string;
  title: string;
  deadlineAt: string | null;
}): void {
  const { actor, assignee, previousAssignee, taskId, title, deadlineAt } = params;

  if (!assignee || assignee === actor || assignee === previousAssignee) return;

  void send([assignee], {
    kind: "task-assigned",
    title: "新しい担当タスク",
    body: `${title}\n${displayName(actor) ?? actor} が登録${deadlineSuffix(deadlineAt)}`,
    // 個別タスクを直接開く URL は今のところ無いので、絞り込み済みの一覧へ送る
    url: "/tasks?scope=mine",
    tag: `task-assigned:${taskId}`,
  });
}

/**
 * 検収者へ「検収待ちになった」ことを知らせる。
 * 検収者が自分でその状態にしたときは送らない。
 */
export function notifyTaskReview(params: {
  actor: string;
  reviewer: string | null;
  taskId: string;
  title: string;
}): void {
  const { actor, reviewer, taskId, title } = params;

  if (!reviewer || reviewer === actor) return;

  void send([reviewer], {
    kind: "task-review",
    title: "検収の依頼",
    body: `${title}\n${displayName(actor) ?? actor} が検収待ちにしました`,
    url: "/tasks?scope=review",
    tag: `task-review:${taskId}`,
  });
}
