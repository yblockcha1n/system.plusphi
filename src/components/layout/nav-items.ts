import { KeyRoundIcon, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** 機能を増やすときはここに足す。サイドバーとヘッダーのタイトルが自動で追従する。 */
export const navItems: NavItem[] = [
  { href: "/credentials", label: "クレデンシャル", icon: KeyRoundIcon },
];
