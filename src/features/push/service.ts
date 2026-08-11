import "server-only";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/lib/push";
import { isPushConfigured } from "@/lib/env";
import type { ActionState } from "@/lib/form";
import type { SessionPayload } from "@/lib/session";
import { pushSubscriptionSchema } from "@/features/push/schema";

const NOT_CONFIGURED = "通知が設定されていません。管理者に VAPID 鍵の設定を依頼してください。";

/**
 * 端末の購読を保存する。
 *
 * endpoint は unique。同じ端末から再度登録されたとき（鍵の更新や、別の利用者が
 * 同じ端末でログインし直したとき）は上書きする。actor をセッションから取るので、
 * 端末を引き継いだ場合も宛先が正しく入れ替わる。
 */
export async function saveSubscription(
  session: SessionPayload,
  input: unknown,
  userAgent: string | null
): Promise<ActionState> {
  if (!isPushConfigured()) {
    return { status: "error", message: NOT_CONFIGURED };
  }

  const parsed = pushSubscriptionSchema.safeParse(
    (input as { subscription?: unknown })?.subscription
  );

  if (!parsed.success) {
    return { status: "error", message: "購読情報が不正です。" };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      actor: session.email,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      // 端末の見分けが付く程度に控える。長すぎる UA は切る。
      user_agent: userAgent?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return { status: "error", message: `通知の登録に失敗しました: ${error.message}` };
  }

  return { status: "success", message: "この端末で通知を受け取ります。" };
}

/** 購読を解除する。endpoint はブラウザ側が持っているものをそのまま受ける。 */
export async function deleteSubscription(input: unknown): Promise<ActionState> {
  const parsed = z.string().url().max(2000).safeParse((input as { endpoint?: unknown })?.endpoint);

  if (!parsed.success) {
    return { status: "error", message: "購読情報が不正です。" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data);

  if (error) {
    return { status: "error", message: `通知の解除に失敗しました: ${error.message}` };
  }

  return { status: "success", message: "この端末への通知を止めました。" };
}

/** 動作確認用に自分あてへ 1 通送る。 */
export async function sendTestNotification(session: SessionPayload): Promise<ActionState> {
  if (!isPushConfigured()) {
    return { status: "error", message: NOT_CONFIGURED };
  }

  const sent = await sendPushToUsers([session.email], {
    kind: "test",
    title: "通知のテスト",
    body: "この通知が見えていれば設定は完了しています。",
    url: "/home",
    tag: "test",
  });

  if (sent === 0) {
    return {
      status: "error",
      message: "送信できる端末がありませんでした。通知をオンにしてから試してください。",
    };
  }

  return { status: "success", message: `${sent} 台の端末へ送信しました。` };
}
