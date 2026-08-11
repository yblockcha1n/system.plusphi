import { z } from "zod";

/**
 * 通知の種類。Service Worker 側で表示のグルーピング（tag）にも使う。
 *  - task-assigned : 自分が担当者に設定された
 *  - task-review   : 自分が検収者のタスクが「検収待ち」になった
 *  - deadline      : 締切のリマインド（定期実行）
 *  - event-soon    : 予定の開始前（定期実行）
 *  - test          : 動作確認用
 */
export const NOTIFICATION_KINDS = [
  "task-assigned",
  "task-review",
  "deadline",
  "event-soon",
  "test",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/**
 * Service Worker へ送る中身。push イベントで JSON として受け取り、
 * そのまま showNotification に渡せる形にしてある。
 */
export type PushPayload = {
  kind: NotificationKind;
  title: string;
  body: string;
  /** 通知をタップしたときに開くパス（同一オリジンの相対パス）。 */
  url: string;
  /**
   * 同じ tag の通知は後から来たもので置き換わる。用件ごとに一意にしておくと、
   * 同じタスクの通知が何通も積み上がらない。
   */
  tag: string;
};

/**
 * ブラウザの PushSubscription を JSON 化したもの。
 * `subscription.toJSON()` の形をそのまま受ける。
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/* ----------------------------- 重複防止のキー ----------------------------- */

/**
 * 定期通知が同じ用件を二度送らないようにするためのキー。
 * notification_deliveries の (actor, dedupe_key) が unique なので、
 * ここが同じ値になる限り 2 通目は DB 側で弾かれる。
 */
export const dedupeKey = {
  /** 締切は「その日ぶん」で 1 回。日付が変われば翌日また通知する。 */
  deadline: (taskId: string, dateKey: string) => `deadline:${taskId}:${dateKey}`,
  /**
   * 予定の開始前リマインドは「その回」につき 1 回だけ。
   * 繰り返しは同じ予定 id で何度も来るので、回を表す日付までキーに含める。
   */
  eventSoon: (eventId: string, occurrenceDate: string) =>
    `event-soon:${eventId}:${occurrenceDate}`,
};
