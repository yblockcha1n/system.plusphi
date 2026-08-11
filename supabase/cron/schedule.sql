-- plusphi 基幹システム: 定期通知のスケジュール登録
--
-- これは migrations に置いていない。CRON_SECRET を埋めないと動かず、
-- その値をリポジトリへ入れられないため。Supabase の SQL Editor で
-- <CRON_SECRET> を実際の値に置き換えてから実行すること
-- （環境変数 CRON_SECRET と同じ文字列。ずれていると 401 になる）。
--
-- URL は「公開されていてアプリに届く HTTPS の URL」であれば何でもよい。
-- ホスティング先が Vercel である必要はなく、独自ドメインで構わない。
-- Supabase はインターネット越しに叩くので localhost は不可。
--
-- なぜ Vercel Cron ではないのか:
--   Vercel の Hobby プランは cron が 1 日 1 回までで、しかも発火時刻が ±59 分ぶれる。
--   「予定の 15 分前」に間に合わないため、分単位で回せる Supabase Cron を使う。
--   （https://vercel.com/docs/cron-jobs/usage-and-pricing）

/* ------------------------------ 拡張の有効化 ------------------------------ */

-- pg_cron: スケジューラ本体 / pg_net: DB から HTTP を投げるための拡張。
-- Supabase では拡張は extensions スキーマに入れる。
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

/* ------------------------------ 定期通知 ------------------------------ */

-- 5 分ごとにアプリの API を叩く。何を送るかの判断はアプリ側が持ち、
-- 二重送信は notification_deliveries の unique 制約が止める（0005 参照）。
--
-- 予定は「開始 15 分前」を 20 分幅で拾う作りなので、5 分間隔なら 1 回飛んでも
-- 取りこぼさない（src/features/push/scheduled.ts）。
select cron.schedule(
  'plusphi-notify',
  '*/5 * * * *',
  $$
  select extensions.http_post(
    url     := 'https://null.plusphi.jp/api/cron/notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer vbklsqg22j/RXEh2t+IH0/VTbK5VngDD/zhD42eEt0k='
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

/* ---------------------------- 送信記録の掃除 ---------------------------- */

-- 毎日 3 時（UTC）に 30 日より古い記録を捨てる。HTTP は挟まず DB 内で完結する。
select cron.schedule(
  'plusphi-purge-deliveries',
  '0 3 * * *',
  $$ select public.purge_notification_deliveries(); $$
);

/* -------------------------------- 確認 -------------------------------- */

-- 登録されているジョブの一覧
--   select jobid, jobname, schedule, active from cron.job;
--
-- 直近の実行結果（成功したか、何秒かかったか）
--   select jobid, status, return_message, start_time
--     from cron.job_run_details
--    order by start_time desc
--    limit 20;
--
-- アプリが返した JSON（送信件数）。pg_net の応答はここに残る。
--   select id, status_code, content, created
--     from net._http_response
--    order by created desc
--    limit 20;
--
-- 止めたいとき
--   select cron.unschedule('plusphi-notify');
--   select cron.unschedule('plusphi-purge-deliveries');
--
-- URL や秘密鍵を変えたいときは、unschedule してから登録し直す
-- （cron.schedule は同名ジョブを上書きするので、そのまま再実行でもよい）。
