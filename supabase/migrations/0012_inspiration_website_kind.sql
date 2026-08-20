-- plusphi 基幹システム: ナレッジに普通の Web ページを加える
-- Supabase の SQL Editor で 0011 の後に実行する。
--
-- 背景: SNS 以外の Web ページも参考として溜めたい。ただし iframe に入れられる
-- サイトは少なく、実測では 18 件中 15 件が X-Frame-Options か CSP の
-- frame-ancestors で拒んでいた。そこで「普通の Web ページ」を 2 つに分ける。
--
--   website … 枠に入れられる。ダイアログの中でそのまま開く
--   link    … 枠に入れさせてもらえない。OGP のカードとして見せ、リンクで開く
--
-- どちらも中身は同じ Web ページで、違うのは見せ方だけ。登録時に相手のヘッダを
-- 見て振り分ける（src/features/inspirations/metadata.ts）。相手が方針を変えても
-- 一覧の「情報を取り直す」で付け直せる。

/* ---------------------------- 許可する値を広げる ---------------------------- */

-- 値は src/features/inspirations/url.ts の CONTENT_KINDS と揃えること。
-- 既存の行は 'unknown' などのまま残り、取り直したときに新しい値へ移る。
alter table public.inspirations
  drop constraint if exists inspirations_content_kind_check;

alter table public.inspirations
  add constraint inspirations_content_kind_check
    check (content_kind in (
      'reel',
      'post',
      'video',
      'short',
      'tweet',
      'account',
      'website',
      'link',
      'unknown'
    ));
