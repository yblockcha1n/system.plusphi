import {
  CalendarDaysIcon,
  FolderKanbanIcon,
  HouseIcon,
  KeyRoundIcon,
  LightbulbIcon,
  MegaphoneIcon,
  ListChecksIcon,
  TagsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
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
 * 機能を増やすときはここに足す。サイドバーとヘッダーのタイトルが
 * まとめて追従する。href は前方一致で「現在地」を判定するため、
 * "/" のような他を巻き込むパスは置かないこと（ホームは /home）。
 *
 * サイドバーはこのグループ単位でアコーディオンになる。モバイルでも同じ中身を
 * ドロワーで出すので、並びと文言は 1 か所で決まる。
 */
export const navGroups: NavGroup[] = [
  {
    id: "top",
    label: null,
    items: [{ href: "/home", label: "ホーム", icon: HouseIcon }],
  },
  {
    id: "work",
    label: "業務",
    items: [
      { href: "/tasks", label: "タスク", icon: ListChecksIcon },
      { href: "/calendar", label: "カレンダー", icon: CalendarDaysIcon },
      { href: "/projects", label: "プロジェクト", icon: FolderKanbanIcon },
    ],
  },
  {
    id: "shared",
    label: "共有情報",
    items: [
      { href: "/inspirations", label: "ナレッジ", icon: LightbulbIcon },
      { href: "/credentials", label: "クレデンシャル", icon: KeyRoundIcon },
      { href: "/release-notes", label: "パッチノート", icon: MegaphoneIcon },
    ],
  },
  {
    id: "settings",
    label: "設定",
    items: [
      {
        href: "/settings/task-types",
        label: "タスク種別",
        icon: TagsIcon,
      },
      {
        href: "/settings/inspiration-tags",
        label: "ナレッジタグ",
        icon: TagsIcon,
      },
    ],
  },
];

/** グループを畳んだ並び。現在地の判定に使う。 */
const navItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
