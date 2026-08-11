-- plusphi 基幹システム: 予定の担当者（複数人）と繰り返し
-- Supabase の SQL Editor で 0005 の後に実行する。
--
-- RLS の方針は 0001 から変わらない（ポリシーを作らない = service_role だけが到達）。

/* ------------------------------ 担当者 ------------------------------ */

-- 予定には複数人が関わる（定例など）ので、タスクの assignee と違って配列で持つ。
-- 中身は ADMIN_USERS のメールアドレス。表示名は env から引く。
--
-- 参加者テーブルに分けていないのは、人数が数人で、検索軸も「自分が入っているか」
-- しか無いため。GIN インデックスがあれば配列のままで足りる。
alter table public.events
  add column if not exists assignees text[] not null default '{}';

create index if not exists events_assignees_idx
  on public.events using gin (assignees);

/* ------------------------------ 繰り返し ------------------------------ */

-- 繰り返しは「予定を人数分コピーして並べる」のではなく、大元の 1 行にルールを持たせ、
-- 表示するときに範囲内ぶんだけ展開する（src/features/calendar/recurrence.ts）。
-- 事前に何百行も作ると、ルールを直したときの追従と無限に続く予定の扱いに困るため。
--
-- starts_at / ends_at は「1 回目」を表す。2 回目以降はそこからの差分で組み立てる。
alter table public.events
  add column if not exists recurrence_freq text,
  -- 「隔週」= weekly かつ 2。1 なら毎回。
  add column if not exists recurrence_interval integer not null default 1,
  -- 繰り返しの終わり（この日を含む）。null なら終わりなし。
  add column if not exists recurrence_until date,
  -- 「この回だけ削除」した日（1 回目の開始日を基準にした日付）。
  add column if not exists recurrence_excluded_dates date[] not null default '{}';

alter table public.events
  drop constraint if exists events_recurrence_freq_check;

alter table public.events
  add constraint events_recurrence_freq_check
  check (recurrence_freq is null or recurrence_freq in ('daily', 'weekly', 'monthly'));

alter table public.events
  drop constraint if exists events_recurrence_interval_check;

alter table public.events
  add constraint events_recurrence_interval_check
  check (recurrence_interval between 1 and 52);

-- 繰り返しの予定は starts_at が「1 回目」なので、範囲検索の条件が単発と異なる。
-- 「開始が範囲より前でも、until が範囲に掛かっていれば対象」になるため、
-- freq が入っている行を素早く拾えるようにしておく。
create index if not exists events_recurrence_idx
  on public.events (recurrence_freq, starts_at)
  where recurrence_freq is not null;
