-- plusphi 基幹システム: 名刺そのものにステータスを持たせる / 初期ステータスの見直し
-- Supabase の SQL Editor で 0010 の後に実行する。
--
-- 背景: 取引先は会社とは限らない。個人事業主や知人など、どこの傘下でもない
-- 相手の名刺も溜まる。そこでステータスを会社だけでなく名刺にも持たせ、
-- 会社に属さない名刺が単独で「取引先」として成立するようにする。

/* --------------------------- 名刺のステータス --------------------------- */

-- 会社と同じマスタ（company_statuses）を共有する。段階の呼び方を 2 つに分ける
-- 理由が無く、分けると設定画面も 2 つになって運用が煩雑になるため。
alter table public.business_cards
  add column if not exists status_id uuid
    references public.company_statuses (id) on delete set null;

create index if not exists business_cards_status_id_idx
  on public.business_cards (status_id);

/* ------------------------------ 初期値の見直し ------------------------------ */

-- 「名刺交換済み」「折衝中」などは細かすぎて実際には使い分けられなかった。
-- 判断に必要なのは「取引が動いているか、まだか」の 2 つだけ。
insert into public.company_statuses (name, description, sort_order)
values
  ('取引中', '実際に取引が動いている',           1),
  ('未取引', 'まだ取引には至っていない相手',     2)
on conflict (name) do nothing;

-- 0010 で入れた初期値のうち、まだどこからも使われていないものだけを消す。
-- 既に付けて運用しているものを勝手に消さないため、参照の有無を必ず見る。
delete from public.company_statuses
 where name in ('未接触', '名刺交換済み', '折衝中', '折衝済み', '見送り')
   and not exists (select 1 from public.companies      where status_id = company_statuses.id)
   and not exists (select 1 from public.business_cards where status_id = company_statuses.id);

-- 「取引中」は 0010 でも入れているので、残っている場合は並び順だけ揃える。
update public.company_statuses set sort_order = 1 where name = '取引中';
update public.company_statuses set sort_order = 2 where name = '未取引';
