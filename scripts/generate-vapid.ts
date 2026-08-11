import webpush from "web-push";

/**
 * Web Push の VAPID 鍵ペアを作る。1 回作ったら使い回すこと。
 *
 * 鍵を差し替えると、既存の購読（push_subscriptions の行）はすべて無効になり、
 * 利用者は端末ごとに通知を登録し直すことになる。
 */
const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log("\n.env.local と Vercel の環境変数に設定してください:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:admin@plusphi.jp");
console.log("\n定期通知（締切・予定）を使う場合は、Supabase Cron から叩くための鍵も設定します:");
console.log(`CRON_SECRET=${webpush.generateVAPIDKeys().privateKey}`);
console.log(
  "\n※ VAPID_PRIVATE_KEY と CRON_SECRET は秘密情報です。リポジトリに入れないこと。\n"
);
