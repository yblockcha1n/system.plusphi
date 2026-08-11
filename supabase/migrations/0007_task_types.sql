-- plusphi 基幹システム: タスク種別のマスタ
-- Supabase の SQL Editor で 0006 の後に実行する。
--
-- RLS の方針は 0001 から変わらない（ポリシーを作らない = service_role だけが到達）。
--
-- 種別を enum やアプリ側の定数にせずテーブルにしたのは、運用しながら
-- 画面から増減・改名したいため（/settings/task-types）。

/* ------------------------------ マスタ ------------------------------ */

create table if not exists public.task_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  -- 使わなくなった種別は消さずに閉じる。過去のタスクの種別表示を保つため。
  -- null = 利用中。
  archived_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger task_types_set_updated_at
  before update on public.task_types
  for each row execute function public.set_updated_at();

create index if not exists task_types_sort_order_idx
  on public.task_types (sort_order, created_at);

-- 同じ名前の種別が並ぶと選ぶときに区別できないので、名前は一意にする。
create unique index if not exists task_types_name_key on public.task_types (name);

alter table public.task_types enable row level security;

/* ------------------------------ タスク側 ------------------------------ */

-- 種別を消してもタスクは消さない（0001 からの方針どおり on delete set null）。
-- null は「種別なし」。
alter table public.tasks
  add column if not exists task_type_id uuid references public.task_types (id) on delete set null;

create index if not exists tasks_task_type_id_idx on public.tasks (task_type_id);

/* --------------------------- 並べ替えの許可 --------------------------- */

-- 0004 の reorder_records はテーブル名をホワイトリストで縛っている。
-- task_types も画面から並べ替えるので、ここに足す。
create or replace function public.reorder_records(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_table not in ('sections', 'projects', 'tasks', 'task_types') then
    raise exception '並べ替えに対応していないテーブルです: %', p_table;
  end if;

  execute format(
    'update public.%I as target
        set sort_order = ordered.position
       from unnest($1) with ordinality as ordered(id, position)
      where target.id = ordered.id',
    p_table
  ) using p_ids;
end;
$$;

/* -------------------------------- seed -------------------------------- */

-- 初期値。画面から自由に増減・改名できるので、あくまで出発点。
-- 既に同名があれば何もしない（このマイグレーションを 2 回流しても増えない）。
insert into public.task_types (name, description, sort_order)
values
  ('開発',      '実装・修正・環境構築',            1),
  ('デザイン',  '画面設計・制作物のデザイン',      2),
  ('資料作成',  '提案書・仕様書・報告書の作成',    3),
  ('打ち合わせ', '社内外の打ち合わせと議事録',      4),
  ('調査・検証', '技術調査、要件のヒアリング',      5),
  ('事務',      '請求・契約・経費などの事務処理',  6),
  ('その他',    '上記に当てはまらないもの',        7)
on conflict (name) do nothing;
