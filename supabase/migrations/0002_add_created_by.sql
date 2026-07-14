-- クレデンシャルの登録者を記録する。
-- 保存するのはメールアドレス（正規の識別子）で、画面に出す表示名は
-- ADMIN_USERS から引く。env から表示名を変えても過去の行に追従できる。
-- 既存行は登録者不明のため null のままにする（画面では「—」と表示）。

alter table public.credentials
  add column if not exists created_by text;
