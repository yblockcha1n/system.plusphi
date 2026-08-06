-- plusphi 基幹システム: プロジェクト / タスク / 予定
-- Supabase の SQL Editor で 0001, 0002 の後に実行する。
--
-- RLS の方針は 0001 と同じ。「有効化するがポリシーを一切作らない」ことで
-- anon / authenticated からは全拒否になり、service_role だけが到達できる。
--
-- 削除の方針も 0001 の sections に揃える。親を消しても子は消さず「未分類」に落とす
-- （on delete set null）。基幹データを親の削除で巻き込んで失わないようにするため。

/* ------------------------------ プロジェクト ------------------------------ */

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  -- カレンダー上の識別色。実際の色は src/features/projects/schema.ts が持つ。
  color       text not null default 'gray',
  sort_order  integer not null default 0,
  -- 完了したプロジェクトは消さずに閉じる。null = 進行中。
  archived_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create index if not exists projects_sort_order_idx on public.projects (sort_order, created_at);

/* -------------------------------- タスク -------------------------------- */

-- project_id が null のものが「未分類」。
-- starts_at / ends_at は作業期間、deadline_at は締切（別概念なので独立して持つ）。
-- assignee / reviewer には ADMIN_USERS のメールアドレスを入れる。表示名は env から引く。
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null,
  detail      text,
  status      text not null default 'todo',
  starts_at   timestamptz,
  ends_at     timestamptz,
  deadline_at timestamptz,
  assignee    text,
  reviewer    text,
  sort_order  integer not null default 0,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint tasks_status_check check (status in ('todo', 'doing', 'review', 'done')),
  constraint tasks_period_check check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create index if not exists tasks_project_id_idx  on public.tasks (project_id, sort_order);
create index if not exists tasks_assignee_idx    on public.tasks (assignee);
create index if not exists tasks_reviewer_idx    on public.tasks (reviewer);
create index if not exists tasks_deadline_at_idx on public.tasks (deadline_at);
-- カレンダーは期間で範囲検索するため
create index if not exists tasks_starts_at_idx   on public.tasks (starts_at);

/* -------------------------------- 予定 -------------------------------- */

-- カレンダーに置く予定。タスクとは別エンティティだが、カレンダー上では
-- タスク（開始〜終了 / 締切）と重ねて表示する。
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete set null,
  title       text not null,
  description text,
  location    text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  -- 終日予定。true のとき starts_at は JST 00:00、ends_at は終了日の JST 翌 00:00。
  all_day     boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint events_range_check check (ends_at >= starts_at)
);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create index if not exists events_starts_at_idx  on public.events (starts_at);
create index if not exists events_project_id_idx on public.events (project_id);

/* --------------------------------- RLS --------------------------------- */

alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.events   enable row level security;
