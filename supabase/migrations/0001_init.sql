-- plusphi 基幹システム: クレデンシャル保管
-- Supabase の SQL Editor で実行する。
--
-- 前提: 認証は Supabase Auth ではなくアプリ側の JWT で行う。DB へのアクセスは
-- service_role キーを持つサーバーサイドのコードからのみ。したがって RLS は
-- 「有効化するがポリシーを一切作らない」= anon / authenticated からは全拒否、
-- service_role のみがバイパスして到達できる、という状態にする。

create extension if not exists "pgcrypto";

-- updated_at を自動更新する
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- セクション（クレデンシャルをグルーピングする枠）
create table if not exists public.sections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger sections_set_updated_at
  before update on public.sections
  for each row execute function public.set_updated_at();

-- クレデンシャル。section_id が null のものが「単一登録（未分類）」。
-- password / notes はアプリ側で AES-256-GCM 暗号化した文字列のみを格納する。
create table if not exists public.credentials (
  id                  uuid primary key default gen_random_uuid(),
  section_id          uuid references public.sections (id) on delete set null,
  name                text not null,
  username            text,
  password_ciphertext text,
  url                 text,
  notes_ciphertext    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger credentials_set_updated_at
  before update on public.credentials
  for each row execute function public.set_updated_at();

create index if not exists credentials_section_id_idx on public.credentials (section_id);
create index if not exists sections_sort_order_idx on public.sections (sort_order, created_at);

alter table public.sections    enable row level security;
alter table public.credentials enable row level security;
