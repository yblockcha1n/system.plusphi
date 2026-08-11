"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronRightIcon, LogOutIcon, PanelLeftIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApiMutation } from "@/components/shared/use-api";
import { findNavItem, navGroups, navItems, type NavItem } from "@/components/layout/nav-items";
import {
  NAV_GROUPS_COOKIE,
  SIDEBAR_COOKIE,
  writeSidebarCookie,
} from "@/components/layout/sidebar-cookie";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationToggle } from "@/components/pwa/notification-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  defaultCollapsed: boolean;
  /** アコーディオンで閉じているグループの id。Cookie から来る。 */
  defaultClosedGroups: string[];
  name: string;
  email: string;
  /**
   * Web Push の VAPID 公開鍵。未設定なら null で、通知ボタンは出さない。
   * 公開鍵なのでクライアントへ渡してよい（秘密鍵はサーバーに置いたまま）。
   */
  vapidPublicKey: string | null;
  children: React.ReactNode;
};

export function AppShell({
  defaultCollapsed,
  defaultClosedGroups,
  name,
  email,
  vapidPublicKey,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [closedGroups, setClosedGroups] = useState(() => new Set(defaultClosedGroups));
  const pathname = usePathname();
  const router = useRouter();
  const { run: runLogout, pending: loggingOut } = useApiMutation();

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // サーバー側の初期描画に反映させ、リロード時のちらつきを防ぐ
    writeSidebarCookie(SIDEBAR_COOKIE, next ? "1" : "0");
  };

  const toggleGroup = (groupId: string) => {
    const next = new Set(closedGroups);

    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }

    setClosedGroups(next);
    writeSidebarCookie(NAV_GROUPS_COOKIE, [...next].join(","));
  };

  const current = findNavItem(pathname);
  const isActive = (href: string) => current?.href === href;

  return (
    // h-svh + overflow-hidden にすることで、スクロールを main の中に閉じ込める。
    // テーブルのヘッダー固定はこれが前提。
    // ライトは薄いグレーの下地。ダークは漆黒にしたいので muted を敷かない。
    <div className="flex h-svh overflow-hidden bg-muted/40 dark:bg-background">
      {/* サイドバーはデスクトップのみ。モバイルは下のボトムナビが担当する。 */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center gap-2 border-b px-3",
            collapsed && "justify-center px-0"
          )}
        >
          <BrandMark className="size-9" size={20} />
          {!collapsed && (
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              plusphi
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {navGroups.map((group) => {
            const links = group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                active={isActive(item.href)}
              />
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
                  onClick={() => toggleGroup(group.id)}
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

        {!collapsed && (
          <div className="border-t p-3">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
            aria-expanded={!collapsed}
            className="hidden lg:inline-flex"
          >
            <PanelLeftIcon />
          </Button>

          {/* モバイルではサイドバーのロゴが見えないのでヘッダーに出す */}
          <BrandMark className="size-8 lg:hidden" size={18} />

          <h1 className="truncate font-heading text-sm font-semibold">
            {current?.label ?? "plusphi"}
          </h1>

          <div className="ml-auto flex items-center gap-1">
            <NotificationToggle vapidPublicKey={vapidPublicKey} />
            <ThemeToggle />
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={loggingOut}
            onClick={() =>
              runLogout(api.logout, { silent: true, onSuccess: () => router.replace("/login") })
            }
          >
            <LogOutIcon />
            <span className="hidden sm:inline">ログアウト</span>
          </Button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>

        {/* モバイルのボトムナビ。ホーム画面から起動したときの下端余白も確保する。 */}
        <nav className="safe-bottom grid shrink-0 grid-cols-5 border-t bg-background lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 border-t-2 py-2 text-[0.625rem] font-medium transition-colors",
                  isActive(item.href)
                    ? "border-t-foreground text-foreground"
                    : "border-t-transparent text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** サイドバーの 1 項目。折りたたみ中はアイコンだけにして名前は title で補う。 */
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
        "flex h-9 items-center gap-2.5 border border-transparent px-2.5 text-sm font-medium transition-colors",
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

/**
 * ブランドマーク。ロゴは黒一色の透過 PNG なので、白い枠の中に置いて
 * 背景に関係なく読めるようにする（ダークテーマでは反転させる）。
 */
function BrandMark({ className, size }: { className?: string; size: number }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center border bg-background",
        className
      )}
    >
      <Image
        src="/logo.png"
        alt="plusphi"
        width={size}
        height={size}
        priority
        className="dark:invert"
      />
    </div>
  );
}
