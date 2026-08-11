-- plusphi 基幹システム: パッチノート
-- Supabase の SQL Editor で 0008 の後に実行する。
--
-- RLS の方針は 0001 から変わらない（ポリシーを作らない = service_role だけが到達）。
--
-- GitHub Actions が push のたびに差分を要約して「下書き」を作り、人が確認して
-- 「公開」したときに全員へ Push 通知が飛ぶ、という流れ。作業途中の push で
-- 全員のスマホが鳴らないよう、公開は必ず人の操作を挟む。

create table if not exists public.release_notes (
  id           uuid primary key default gen_random_uuid(),
  -- 表示用のラベル（例 2026.08.12-1）。CI が日付から採番する。
  version      text not null,
  title        text not null,
  -- 本文。行頭の "・" や見出しを含むプレーンテキストとして持つ。
  body         text not null,
  -- draft = 下書き（本人しか見ない） / published = 公開済み
  status       text not null default 'draft',
  published_at timestamptz,
  /*
   * どこからどこまでの変更を対象にしたか。
   *
   * base_sha は「前回公開したときの HEAD」。次に CI が走るときは、この値を
   * 起点に差分を取り直して下書きを作り直す。こうしておくと、公開せずに
   * 何度 push しても「前回の公開以降ぶん」を 1 件の下書きが常に表す。
   */
  base_sha     text,
  head_sha     text,
  commit_count integer not null default 0,
  /** 生成に使ったモデル。あとから「これは自動生成か」を判断できるように残す。 */
  generated_by text,
  -- 下書きを作ったのは CI なのでメールアドレスは入らない。公開した人は publisher に入る。
  publisher    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint release_notes_status_check check (status in ('draft', 'published'))
);

create trigger release_notes_set_updated_at
  before update on public.release_notes
  for each row execute function public.set_updated_at();

-- 一覧は新しい順。公開済みだけを引く場面が多いので status も索引に含める。
create index if not exists release_notes_created_at_idx
  on public.release_notes (created_at desc);
create index if not exists release_notes_status_idx
  on public.release_notes (status, published_at desc);

/*
 * 下書きは同時に 1 件しか持たない。
 *
 * CI は push のたびに走るが、未公開の下書きがあればそれを上書きする作りにして
 * ある。ここで一意にしておけば、実装が取りこぼしても DB 側で二重作成を止められる。
 */
create unique index if not exists release_notes_single_draft_idx
  on public.release_notes ((status))
  where status = 'draft';

alter table public.release_notes enable row level security;
