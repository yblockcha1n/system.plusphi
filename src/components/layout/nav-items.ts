import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  HouseIcon,
  KeyRoundIcon,
  ListChecksIcon,
  TagsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** モバイルのボトムナビは幅が狭いので、そこだけ短い名前を使う。 */
  shortLabel: string;
  icon: LucideIcon;
};

export type NavGroup = {
  /** 開閉状態を Cookie に保存するときのキー。変えると保存済みの状態が失われる。 */
  id: string;
  /** null なら見出しを出さず、折りたためない（常に見えていてほしい項目用）。 */
  label: string | null;
  items: NavItem[];
};

/**
 * 機能を増やすときはここに足す。サイドバー・ボトムナビ・ヘッダーのタイトルが
 * まとめて追従する。href は前方一致で「現在地」を判定するため、
 * "/" のような他を巻き込むパスは置かないこと（ホームは /home）。
 *
 * サイドバーはこのグループ単位でアコーディオンになる。ボトムナビ（モバイル）は
 * 幅が無いのでグループを無視して navItems の並びをそのまま横に置く。
 */
export const navGroups: NavGroup[] = [
  {
    id: "top",
    label: null,
    items: [{ href: "/home", label: "ホーム", shortLabel: "ホーム", icon: HouseIcon }],
  },
  {
    id: "work",
    label: "業務",
    items: [
      { href: "/tasks", label: "タスク", shortLabel: "タスク", icon: ListChecksIcon },
      { href: "/calendar", label: "カレンダー", shortLabel: "予定", icon: CalendarDaysIcon },
      { href: "/projects", label: "プロジェクト", shortLabel: "PJ", icon: FolderKanbanIcon },
    ],
  },
  {
    id: "shared",
    label: "共有情報",
    items: [
      { href: "/credentials", label: "クレデンシャル", shortLabel: "鍵", icon: KeyRoundIcon },
    ],
  },
  {
    id: "settings",
    label: "設定",
    items: [
      {
        href: "/settings/task-types",
        label: "タスク種別",
        shortLabel: "種別",
        icon: TagsIcon,
      },
    ],
  },
];

/** グループを畳んだ並び。ボトムナビと現在地の判定に使う。 */
export const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
