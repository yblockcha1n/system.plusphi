"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOutIcon, PanelLeftIcon, ShieldCheckIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApiMutation } from "@/components/shared/use-api";
import { findNavItem, navItems } from "@/components/layout/nav-items";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppShellProps = {
  defaultCollapsed: boolean;
  name: string;
  email: string;
  children: React.ReactNode;
};

export function AppShell({ defaultCollapsed, name, email, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const pathname = usePathname();
  const router = useRouter();
  const { run: runLogout, pending: loggingOut } = useApiMutation();

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // サーバー側の初期描画に反映させ、リロード時のちらつきを防ぐ
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  const current = findNavItem(pathname);
  const isActive = (href: string) => current?.href === href;

  return (
    // h-svh + overflow-hidden にすることで、スクロールを main の中に閉じ込める。
    // テーブルのヘッダー固定はこれが前提。
    <div className="flex h-svh overflow-hidden bg-muted/40">
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
          <div className="flex size-9 shrink-0 items-center justify-center bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheckIcon className="size-4.5" />
          </div>
          {!collapsed && (
            <span className="truncate font-heading text-sm font-semibold tracking-tight">
              plusphi
            </span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 border border-transparent px-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive(item.href)
                    ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
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
          <div className="flex size-8 shrink-0 items-center justify-center bg-primary text-primary-foreground lg:hidden">
            <ShieldCheckIcon className="size-4" />
          </div>

          <h1 className="truncate font-heading text-sm font-semibold">
            {current?.label ?? "plusphi"}
          </h1>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
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
