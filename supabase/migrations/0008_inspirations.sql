-- plusphi 基幹システム: クリエイティブのナレッジベース（参考動画）
-- Supabase の SQL Editor で 0007 の後に実行する。
--
-- RLS の方針は 0001 から変わらない（ポリシーを作らない = service_role だけが到達）。
--
-- 参考にした投稿の URL・メモ・タグを溜めて、あとから探して見返すための置き場。
-- 再生は保存した URL から組み立てた埋め込み URL を iframe で開く（外部 API キー不要）。

/* ------------------------------ タグのマスタ ------------------------------ */

-- 0007 の task_types と同じ作り。運用しながら画面から増減・改名する。
create table if not exists public.inspiration_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  -- 使わなくなったタグは消さずに閉じる。過去の紐づけを保つため。null = 利用中。
  archived_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger inspiration_tags_set_updated_at
  before update on public.inspiration_tags
  for each row execute function public.set_updated_at();

create index if not exists inspiration_tags_sort_order_idx
  on public.inspiration_tags (sort_order, created_at);

-- 同じ名前のタグが並ぶと選ぶときに区別できないので、名前は一意にする。
create unique index if not exists inspiration_tags_name_key
  on public.inspiration_tags (name);

/* -------------------------------- 本体 -------------------------------- */

-- platform / content_kind の値は src/features/inspirations/url.ts と揃えること。
-- 判定できないものは 'other' / 'unknown' に倒して、必ず保存できるようにする
-- （URL とメモだけでもナレッジとしては成立するため）。
create table if not exists public.inspirations (
  id             uuid primary key default gen_random_uuid(),
  -- 正規化後の URL（トラッキングパラメータを落としたもの）
  url            text not null,
  platform       text not null default 'other',
  content_kind   text not null default 'unknown',
  -- ショートコードや動画 ID。埋め込み URL の組み立てに使う。
  external_id    text,
  -- 自動取得できたら入る。手で上書きできる。
  title          text,
  author_name    text,
  -- なぜ参考になるのかの覚書。この機能の肝なので必ず手入力できるようにする。
  note           text,
  -- Storage 上のパス。取得できなければ null（サムネ無しで一覧に出る）。
  thumbnail_path text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint inspirations_platform_check
    check (platform in ('instagram', 'tiktok', 'youtube', 'x', 'other')),
  constraint inspirations_content_kind_check
    check (content_kind in ('reel', 'post', 'video', 'short', 'tweet', 'account', 'unknown'))
);

create trigger inspirations_set_updated_at
  before update on public.inspirations
  for each row execute function public.set_updated_at();

-- 一覧は新しい順に出す
create index if not exists inspirations_created_at_idx
  on public.inspirations (created_at desc);
create index if not exists inspirations_platform_idx
  on public.inspirations (platform);

-- 同じ URL を二度登録しても意味が無いので弾く。
create unique index if not exists inspirations_url_key on public.inspirations (url);

/* ------------------------------ タグの紐づけ ------------------------------ */

-- 1 件に複数のタグを付ける。タグを消したら紐づけだけが消える（本体は残る）。
--
-- 配列列ではなく表にしているのは、タグがマスタ管理で削除・停止できるため。
-- 参照整合性が要るうえ、マスタ画面の「何件で使われているか」もここから数える。
create table if not exists public.inspiration_tag_links (
  inspiration_id uuid not null references public.inspirations (id) on delete cascade,
  tag_id         uuid not null references public.inspiration_tags (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (inspiration_id, tag_id)
);

-- 「このタグが付いた投稿」を引く向きの索引（主キーは逆向きなので別に張る）
create index if not exists inspiration_tag_links_tag_id_idx
  on public.inspiration_tag_links (tag_id);

/* --------------------------- 並べ替えの許可 --------------------------- */

-- 0004 の reorder_records はテーブル名をホワイトリストで縛っている。
-- inspiration_tags も画面から並べ替えるので、ここに足す。
create or replace function public.reorder_records(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_table not in ('sections', 'projects', 'tasks', 'task_types', 'inspiration_tags') then
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

/* --------------------------------- RLS --------------------------------- */

alter table public.inspiration_tags      enable row level security;
alter table public.inspirations          enable row level security;
alter table public.inspiration_tag_links enable row level security;

/* ------------------------------ サムネ置き場 ------------------------------ */

-- 非公開バケット。読み出しはサーバーが発行する署名付き URL 経由にする。
-- 公開バケットにすると URL を知っている誰でも見られてしまい、
-- 他の画面（クレデンシャル等）と方針が食い違う。
--
-- 元の CDN URL をそのまま保存しない理由: Instagram のサムネ URL には有効期限
-- （oe= パラメータ）が入っており、数週間で画像が表示できなくなるため。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspiration-thumbnails',
  'inspiration-thumbnails',
  false,
  5242880, -- 5MB。サムネ 1 枚は数十 KB なので十分。
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/* -------------------------------- seed -------------------------------- */

-- 初期のタグ。画面から自由に増減・改名できるので、あくまで出発点。
insert into public.inspiration_tags (name, description, sort_order)
values
  ('構図',       'カメラワーク・画角・レイアウトの参考',   1),
  ('編集',       'カット割り・トランジション・テロップ',   2),
  ('BGM・音',    '音楽の選び方、効果音の使い方',           3),
  ('企画',       'ネタ・切り口・構成の参考',               4),
  ('商品訴求',   '商品の見せ方、訴求の作り方',             5),
  ('トレンド',   '今きている型・フォーマット',             6)
on conflict (name) do nothing;
