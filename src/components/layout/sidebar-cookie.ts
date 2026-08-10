/**
 * サイドバーの状態。どちらもサーバー側の初期描画で読むためクライアントと共有する。
 *
 * localStorage ではなく Cookie に置いているのは、リロード直後の 1 フレームを
 * 正しい状態で描くため。localStorage はクライアントでしか読めないので、
 * サーバーが既定の状態で描いたあとに JS が直すことになり、開いた状態が
 * 一瞬閉じて見える（またはその逆）。
 */

/** サイドバー自体の折りたたみ。"1" = 折りたたみ済み。 */
export const SIDEBAR_COOKIE = "plusphi_sidebar_collapsed";

/**
 * アコーディオンで「閉じている」グループの id をカンマ区切りで持つ。
 *
 * 開いているほうではなく閉じているほうを保存する。こうしておくと、あとから
 * nav-items.ts にグループを足したとき、保存済みの Cookie に載っていない
 * 新しいグループが既定で開いた状態になる。
 */
export const NAV_GROUPS_COOKIE = "plusphi_nav_closed";

export function parseClosedGroups(value: string | undefined): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/** 1 年。サイドバーの状態は明示的に変えるまで持ち越してよい。 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** クライアントから Cookie を書く。サーバー側では呼ばないこと。 */
export function writeSidebarCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}
