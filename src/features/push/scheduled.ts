import "server-only";
import { supabase } from "@/lib/supabase";
import { sendPushOnce } from "@/lib/push";
import { addMinutes, dateKey, formatTime, startOfDay } from "@/lib/datetime";
import { dedupeKey } from "@/features/push/schema";

/**
 * Supabase Cron から定期的に呼ばれる通知。
 *
 * 「今この瞬間に送るべきものだけ」を毎回計算し、送信済みかどうかは
 * notification_deliveries の unique 制約に任せる（lib/push.ts の sendPushOnce）。
 * 実行が重なっても二重に届かないので、Cron の間隔を短くしても安全。
 */

export type ScheduledResult = {
  deadline: number;
  eventSoon: number;
};

/** 予定は開始のどれくらい前に知らせるか。 */
const EVENT_LEAD_MIN = 15;

/**
 * Cron の間隔が延びたり 1 回飛んだりしても取りこぼさないよう、
 * 「15 分前ちょうど」ではなく幅で拾う。dedupe があるので重複はしない。
 */
const EVENT_WINDOW_MIN = 20;

export async function runScheduledNotifications(now = new Date()): Promise<ScheduledResult> {
  const [deadline, eventSoon] = await Promise.all([
    notifyDeadlines(now),
    notifyUpcomingEvents(now),
  ]);

  return { deadline, eventSoon };
}

/**
 * 締切のリマインド。
 *
 * 対象は「未完了 かつ 締切が今日中（＝ 今日の終わりまで）」のタスク。
 * 締切を過ぎたまま放置されているものも毎日入るので、超過の督促も兼ねる。
 * 宛先は担当者。担当者が未設定のタスクは送りようがないので飛ばす。
 */
async function notifyDeadlines(now: Date): Promise<number> {
  const endOfToday = addMinutes(startOfDay(now), 24 * 60);
  const today = dateKey(now);

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, deadline_at, assignee")
    .neq("status", "done")
    .not("deadline_at", "is", null)
    .not("assignee", "is", null)
    .lt("deadline_at", endOfToday.toISOString());

  if (error) {
    console.error("[cron] 締切タスクの取得に失敗しました", { message: error.message });
    return 0;
  }

  const results = await Promise.all(
    data.map(async (task) => {
      const assignee = task.assignee as string;
      const deadline = new Date(task.deadline_at as string);
      const overdue = deadline.getTime() < now.getTime();

      return sendPushOnce(assignee, dedupeKey.deadline(task.id, today), {
        kind: "deadline",
        title: overdue ? "締切を過ぎています" : "今日が締切です",
        body: `${task.title}\n締切 ${formatTime(deadline)}`,
        url: "/tasks?scope=mine",
        tag: `deadline:${task.id}`,
      });
    })
  );

  return results.filter(Boolean).length;
}

/**
 * 予定の開始前リマインド。宛先は予定の作成者。
 *
 * 予定には担当者の概念が無いため、カレンダーの色分けと同じ考え方で
 * 作成者を「その予定の持ち主」として扱う。
 */
async function notifyUpcomingEvents(now: Date): Promise<number> {
  const from = addMinutes(now, EVENT_LEAD_MIN - EVENT_WINDOW_MIN);
  const to = addMinutes(now, EVENT_LEAD_MIN);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, location, created_by")
    .not("created_by", "is", null)
    // 終日予定に「15 分前」は意味が無いので外す
    .eq("all_day", false)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString());

  if (error) {
    console.error("[cron] 予定の取得に失敗しました", { message: error.message });
    return 0;
  }

  const results = await Promise.all(
    data.map(async (event) => {
      const owner = event.created_by as string;
      const startsAt = new Date(event.starts_at);

      return sendPushOnce(owner, dedupeKey.eventSoon(event.id), {
        kind: "event-soon",
        title: "まもなく開始",
        body: `${event.title}\n${formatTime(startsAt)}${event.location ? `・${event.location}` : ""}`,
        url: `/calendar?view=day&date=${dateKey(startsAt)}`,
        tag: `event-soon:${event.id}`,
      });
    })
  );

  return results.filter(Boolean).length;
}
