-- plusphi 基幹システム: Web Push 通知
-- Supabase の SQL Editor で 0004 の後に実行する。
--
-- RLS の方針は 0001 から変わらない。「有効化するがポリシーを一切作らない」ことで
-- anon / authenticated からは全拒否になり、service_role だけが到達できる。
--
-- 定期通知（締切・予定）のスケジュール登録はこのファイルには含めない。
-- 本番 URL と CRON_SECRET を埋める必要があるため supabase/cron/schedule.sql に分けてある。

/* ---------------------------- 購読（端末ごと） ---------------------------- */

-- 1 人が PC・スマートフォンなど複数の端末から購読するので、行は「利用者 × 端末」。
-- endpoint がブラウザ側で発行される一意な宛先で、そのまま主キー代わりに使える。
--
-- 鍵（p256dh / auth）はブラウザが払い出す購読用の公開鍵であって、こちらの秘密では
-- ない。漏れても既存の購読へ通知を送れるのは VAPID 秘密鍵を持つ側だけなので、
-- credentials と違って暗号化はしない。
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  -- 購読した利用者のメールアドレス（セッションから取る。表示名は ADMIN_USERS から引く）
  actor      text not null,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  -- どの端末か分かるように控えておく（一覧で「解除」を選ぶときの手掛かり）
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

create index if not exists push_subscriptions_actor_idx
  on public.push_subscriptions (actor);

/* ------------------------- 送信済みの記録（重複防止） ------------------------- */

-- 定期通知は Cron から繰り返し呼ばれるため、同じ用件を何度も送らないように
-- 「送った」ことを残す。unique 制約で二重送信を DB 側で止めるのが要点で、
-- アプリ側で「送ったかどうか」を先に問い合わせる作りだと、実行が重なった
-- ときにすり抜ける。
--
-- dedupe_key の作り方は features/push/schema.ts に合わせる。例:
--   deadline:<task_id>:2026-08-12   （その日の締切リマインドは 1 回だけ）
--   event:<event_id>                （予定の開始前リマインドは 1 回だけ）
create table if not exists public.notification_deliveries (
  id         uuid primary key default gen_random_uuid(),
  -- 通知の種類（task-assigned / task-review / deadline / event-soon）
  kind       text not null,
  -- 宛先の利用者。同じ用件でも人ごとに 1 通なので、キーに含める。
  actor      text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  constraint notification_deliveries_unique unique (actor, dedupe_key)
);

create index if not exists notification_deliveries_created_at_idx
  on public.notification_deliveries (created_at desc);

/* --------------------------------- RLS --------------------------------- */

alter table public.push_subscriptions      enable row level security;
alter table public.notification_deliveries enable row level security;

/* ------------------------------ 古い記録の掃除 ------------------------------ */

-- notification_deliveries は放っておくと増え続ける。重複を止めたいのは
-- 「同じ用件が繰り返し来る間」だけなので、古い行は捨てて構わない。
-- supabase/cron/schedule.sql から 1 日 1 回呼ぶ。
create or replace function public.purge_notification_deliveries()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  delete from public.notification_deliveries
   where created_at < now() - interval '30 days';
$$;
