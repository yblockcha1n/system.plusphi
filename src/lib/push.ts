import "server-only";
import webpush, { WebPushError } from "web-push";
import { env, isPushConfigured } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { PushPayload } from "@/features/push/schema";

/**
 * Web Push の送信口。
 *
 * VAPID 鍵が未設定なら何もせず 0 件を返す（env.ts のコメント参照）。通知が
 * 送れないことでタスクの保存まで失敗させたくないので、この層は例外を投げない。
 */

let configured = false;

function ensureConfigured(): boolean {
  if (!isPushConfigured()) return false;

  if (!configured) {
    webpush.setVapidDetails(
      env.VAPID_SUBJECT,
      env.VAPID_PUBLIC_KEY as string,
      env.VAPID_PRIVATE_KEY as string
    );
    configured = true;
  }

  return true;
}

/**
 * 指定した利用者たちの全端末へ送る。
 *
 * @returns 実際に送れた端末数。
 */
export async function sendPushToUsers(
  emails: string[],
  payload: PushPayload
): Promise<number> {
  const targets = [...new Set(emails.filter(Boolean))];

  if (targets.length === 0 || !ensureConfigured()) return 0;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("actor", targets);

  if (error) {
    console.error("[push] 購読の取得に失敗しました", { message: error.message });
    return 0;
  }

  const body = JSON.stringify(payload);
  const expired: string[] = [];

  const results = await Promise.all(
    data.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          body
        );
        return true;
      } catch (cause) {
        // 404 / 410 は「その購読はもう存在しない」。端末側でアンインストールされたり
        // 通知を拒否に変えられたときに返る。掃除しないと毎回無駄に叩き続ける。
        if (cause instanceof WebPushError && (cause.statusCode === 404 || cause.statusCode === 410)) {
          expired.push(row.endpoint);
        } else {
          console.error("[push] 送信に失敗しました", {
            endpoint: row.endpoint,
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
        return false;
      }
    })
  );

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return results.filter(Boolean).length;
}

/**
 * まだ送っていなければ送る。
 *
 * 先に notification_deliveries へ insert し、unique 制約に弾かれたら
 * 「既に送信済み」とみなして何もしない。送る前に SELECT で確認する作りだと、
 * Cron の実行が重なったときに 2 通届いてしまう。
 */
export async function sendPushOnce(
  email: string,
  dedupeKey: string,
  payload: PushPayload
): Promise<boolean> {
  if (!email || !ensureConfigured()) return false;

  const { error } = await supabase.from("notification_deliveries").insert({
    kind: payload.kind,
    actor: email,
    dedupe_key: dedupeKey,
  });

  if (error) {
    // 23505 = unique_violation。送信済みなので黙って終わる。
    if (error.code !== "23505") {
      console.error("[push] 送信記録に失敗しました", { dedupeKey, message: error.message });
    }
    return false;
  }

  const sent = await sendPushToUsers([email], payload);

  // 送れなかった（購読が 1 件も無い等）なら記録を戻す。残したままだと、
  // あとで端末を登録しても「送信済み」扱いで永久に届かなくなる。
  if (sent === 0) {
    await supabase
      .from("notification_deliveries")
      .delete()
      .eq("actor", email)
      .eq("dedupe_key", dedupeKey);
  }

  return sent > 0;
}
