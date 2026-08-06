-- plusphi 基幹システム: 並べ替えの原子化 / 集計の SQL 化 / クレデンシャル閲覧の監査ログ
-- Supabase の SQL Editor で 0003 の後に実行する。
--
-- RLS の方針は 0001 から変わらない。「有効化するがポリシーを一切作らない」ことで
-- anon / authenticated からは全拒否になり、service_role だけが到達できる。

/* ---------------------------- 並べ替えの原子化 ---------------------------- */

-- 以前はアプリ側から id の数だけ UPDATE を並列に投げていたため、途中で失敗すると
-- 一部だけ新しい順序という中途半端な状態が残った。1 本の UPDATE にまとめて
-- 関数の中で実行することで、全部通るか全部戻るかのどちらかになる。
--
-- p_table を動的 SQL に渡すのでホワイトリストで縛る。%I（識別子としての引用）と
-- 併用しているため、値が素通しで SQL に埋まることはない。
create or replace function public.reorder_records(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_table not in ('sections', 'projects', 'tasks') then
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

/* ------------------------- プロジェクトの進捗集計 ------------------------- */

-- 以前はタスクを全件アプリへ引いてから JS で数えていた。件数に比例して転送量が
-- 増える一方、欲しいのはプロジェクトごとの 3 つの数値だけなので SQL 側で畳む。
-- overdue の定義はアプリ側と揃える（未完了 かつ 締切が過去）。
create or replace function public.project_task_stats()
returns table (
  project_id uuid,
  total      bigint,
  done       bigint,
  overdue    bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    tasks.project_id,
    count(*)                                             as total,
    count(*) filter (where tasks.status = 'done')        as done,
    count(*) filter (
      where tasks.status <> 'done'
        and tasks.deadline_at is not null
        and tasks.deadline_at < now()
    )                                                    as overdue
  from public.tasks
  where tasks.project_id is not null
  group by tasks.project_id;
$$;

/* --------------------------- 閲覧の監査ログ --------------------------- */

-- クレデンシャルは全員が全件を見られる共有金庫として運用している（行ごとの
-- 権限は持たせない）。そのぶん「誰がいつ何を復号したか」は残しておく。
--
-- credential_id は on delete set null。クレデンシャルを消しても記録は残したいので、
-- そのとき何を見たのか分かるように名称を控えたスナップショットも持つ。
create table if not exists public.credential_access_log (
  id              uuid primary key default gen_random_uuid(),
  credential_id   uuid references public.credentials (id) on delete set null,
  -- 参照先が消えたあとでも追えるようにするための控え
  credential_name text not null,
  -- 閲覧した利用者のメールアドレス（セッションから取る。表示名は ADMIN_USERS から引く）
  actor           text not null,
  field           text not null,
  created_at      timestamptz not null default now(),
  constraint credential_access_log_field_check check (field in ('password', 'notes'))
);

create index if not exists credential_access_log_created_at_idx
  on public.credential_access_log (created_at desc);
create index if not exists credential_access_log_credential_id_idx
  on public.credential_access_log (credential_id, created_at desc);
create index if not exists credential_access_log_actor_idx
  on public.credential_access_log (actor, created_at desc);

alter table public.credential_access_log enable row level security;
