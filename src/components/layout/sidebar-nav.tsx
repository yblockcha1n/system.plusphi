"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { navGroups, type NavItem } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  /** アイコンだけの細い表示にするか。モバイルのドロワーでは常に false。 */
  collapsed: boolean;
  /** 閉じているグループの id。 */
  closedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  isActive: (href: string) => boolean;
};

/**
 * グループ分けされたナビゲーション本体。
 *
 * デスクトップの固定サイドバーと、モバイルのドロワーの両方から使う。
 * 片方だけに項目を足す事故を防ぐため、描画はここ 1 箇所に集約している。
 */
export function SidebarNav({
  collapsed,
  closedGroups,
  onToggleGroup,
  isActive,
}: SidebarNavProps) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {navGroups.map((group) => {
        const links = group.items.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} />
        ));

        // 折りたたみ中は見出しを出す幅が無いので、グループを無視して並べる
        if (collapsed || group.label === null) {
          return <Fragment key={group.id}>{links}</Fragment>;
        }

        const isOpen = !closedGroups.has(group.id);
        // 閉じたグループの中に現在地があると、どこに居るのか分からなくなる
        const holdsCurrent = group.items.some((item) => isActive(item.href));

        return (
          // 見出しの上に間を空ける。ただし nav の先頭に来たときは詰める
          // （first: は nav の直接の子であるこの div に対して効かせる）
          <div key={group.id} className="mt-2 flex flex-col gap-0.5 first:mt-0">
            <button
              type="button"
              onClick={() => onToggleGroup(group.id)}
              aria-expanded={isOpen}
              aria-controls={`nav-group-${group.id}`}
              className={cn(
                "flex h-7 items-center gap-1 px-2.5 text-xs font-medium transition-colors",
                !isOpen && holdsCurrent
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ChevronRightIcon
                className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
              />
              <span className="truncate">{group.label}</span>
              {!isOpen && holdsCurrent && (
                <span className="size-1.5 shrink-0 bg-foreground" aria-hidden />
              )}
            </button>

            {isOpen && (
              <div id={`nav-group-${group.id}`} className="flex flex-col gap-0.5">
                {links}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** 1 項目。折りたたみ中はアイコンだけにして名前は title で補う。 */
function NavLink({
  item,
  collapsed,
  active,
}: {
  item: NavItem;
  collapsed: boolean;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        // 指で押す前提の高さ。デスクトップでは詰めて情報量を優先する。
        "flex h-11 items-center gap-2.5 border border-transparent px-2.5 text-sm font-medium transition-colors lg:h-9",
        collapsed && "justify-center px-0",
        active
          ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}
