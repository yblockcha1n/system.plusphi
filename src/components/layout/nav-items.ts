import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  HouseIcon,
  KeyRoundIcon,
  ListChecksIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  /** モバイルのボトムナビは幅が狭いので、そこだけ短い名前を使う。 */
  shortLabel: string;
  icon: LucideIcon;
};

/**
 * 機能を増やすときはここに足す。サイドバー・ボトムナビ・ヘッダーのタイトルが
 * まとめて追従する。href は前方一致で「現在地」を判定するため、
 * "/" のような他を巻き込むパスは置かないこと（ホームは /home）。
 */
export const navItems: NavItem[] = [
  { href: "/home", label: "ホーム", shortLabel: "ホーム", icon: HouseIcon },
  { href: "/tasks", label: "タスク", shortLabel: "タスク", icon: ListChecksIcon },
  { href: "/calendar", label: "カレンダー", shortLabel: "予定", icon: CalendarDaysIcon },
  { href: "/projects", label: "プロジェクト", shortLabel: "PJ", icon: FolderKanbanIcon },
  { href: "/credentials", label: "クレデンシャル", shortLabel: "鍵", icon: KeyRoundIcon },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
