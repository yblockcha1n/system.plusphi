-- plusphi 基幹システム: 名刺管理と取引先のステータス管理
-- Supabase の SQL Editor で 0009 の後に実行する。
--
-- RLS の方針は 0001 から変わらない（ポリシーを作らない = service_role だけが到達）。
-- 削除の方針も同じ。親を消しても子は消さず「未設定」に落とす（on delete set null）。

/* --------------------------- ステータスのマスタ --------------------------- */

-- まだ toB の取引先ではない相手も含めて「どこまで話が進んでいるか」を表す。
-- 0007 の task_types と同じ作りで、運用しながら画面から増減・改名する。
create table if not exists public.company_statuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  -- 使わなくなった区分は消さずに閉じる。過去の会社の表示を保つため。null = 利用中。
  archived_at timestamptz,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger company_statuses_set_updated_at
  before update on public.company_statuses
  for each row execute function public.set_updated_at();

create index if not exists company_statuses_sort_order_idx
  on public.company_statuses (sort_order, created_at);

create unique index if not exists company_statuses_name_key
  on public.company_statuses (name);

/* -------------------------------- 取引先 -------------------------------- */

-- ステータスは会社に 1 つだけ。同じ会社の複数人と名刺交換しても
-- 「その会社と今どこまで進んでいるか」は 1 つに定まるべきで、
-- 人ごとに持たせるとどれが正か分からなくなるため。
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  -- 表記ゆれの照合と並べ替えに使う。手入力・OCR のどちらでも空でよい。
  name_kana  text,
  status_id  uuid references public.company_statuses (id) on delete set null,
  website    text,
  address    text,
  phone      text,
  note       text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

create index if not exists companies_status_id_idx on public.companies (status_id);
create index if not exists companies_name_idx      on public.companies (name);

/* -------------------------------- 名刺 -------------------------------- */

-- 1 行が 1 枚の名刺（＝担当者）。会社が決まっていなくても登録できる
-- （その場で会社を作らせると、表記ゆれで会社が乱立するため）。
--
-- source は入手経路。
--   paper   : 紙の名刺を撮影
--   digital : 電子名刺のスクリーンショットを撮影
--   vcard   : vCard(.vcf) から取り込み
--   manual  : 手入力
create table if not exists public.business_cards (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies (id) on delete set null,
  full_name        text not null,
  full_name_kana   text,
  department       text,
  title            text,
  email            text,
  phone            text,
  mobile           text,
  -- Eight / Sansan などのプロフィール URL。取りに行かず、開くだけに使う。
  digital_card_url text,
  source           text not null default 'manual',
  -- Storage 上のパス。紙・スクリーンショットのときだけ入る。
  image_path       text,
  received_at      date,
  note             text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint business_cards_source_check
    check (source in ('paper', 'digital', 'vcard', 'manual'))
);

create trigger business_cards_set_updated_at
  before update on public.business_cards
  for each row execute function public.set_updated_at();

create index if not exists business_cards_company_id_idx on public.business_cards (company_id);
create index if not exists business_cards_email_idx      on public.business_cards (email);
create index if not exists business_cards_created_at_idx on public.business_cards (created_at desc);

/* --------------------------- 並べ替えの許可 --------------------------- */

-- 0004 の reorder_records はテーブル名をホワイトリストで縛っている。
-- company_statuses も画面から並べ替えるので、ここに足す。
create or replace function public.reorder_records(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_table not in (
    'sections', 'projects', 'tasks', 'task_types', 'inspiration_tags', 'company_statuses'
  ) then
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

alter table public.company_statuses enable row level security;
alter table public.companies        enable row level security;
alter table public.business_cards   enable row level security;

/* ------------------------------ 名刺画像 ------------------------------ */

-- 非公開バケット。名刺は個人情報なので、読み出しは必ず署名付き URL 経由にする。
-- 公開バケットにすると URL を知っている誰でも見られてしまう。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-cards',
  'business-cards',
  false,
  5242880, -- 5MB。ブラウザ側で縮小してから送るので十分。
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

/* -------------------------------- seed -------------------------------- */

-- 初期のステータス。画面から自由に増減・改名できるので、あくまで出発点。
insert into public.company_statuses (name, description, sort_order)
values
  ('未接触',       'リストにあるが、まだ接点が無い',           1),
  ('名刺交換済み', '一度会って名刺を交換した段階',             2),
  ('折衝中',       '具体的な話を進めている最中',               3),
  ('折衝済み',     '話がまとまり、着手や発注を待っている',     4),
  ('取引中',       '実際に取引が動いている',                   5),
  ('見送り',       '今回は縁が無かった。記録として残す',       6)
on conflict (name) do nothing;
