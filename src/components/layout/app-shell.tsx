"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOutIcon, PanelLeftIcon, ShieldCheckIcon } from "lucide-react";
import { logout } from "@/features/auth/actions";
import { navItems } from "@/components/layout/nav-items";
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

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // サーバー側の初期描画に反映させ、リロード時のちらつきを防ぐ
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  const currentTitle =
    navItems.find((item) => pathname.startsWith(item.href))?.label ?? "plusphi";

  return (
    // h-svh + overflow-hidden にすることで、スクロールを main の中に閉じ込める。
    // テーブルのヘッダー固定はこれが前提。
    <div className="flex h-svh overflow-hidden bg-muted/40">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 items-center gap-2 border-b px-3",
            collapsed && "justify-center px-0"
          )}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheckIcon className="size-4.5" />
          </div>
          {!collapsed && (
            <span className="truncate font-heading text-sm font-semibold">plusphi</span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
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
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
            aria-expanded={!collapsed}
          >
            <PanelLeftIcon />
          </Button>

          <h1 className="font-heading text-sm font-semibold">{currentTitle}</h1>

          <form action={logout} className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              <LogOutIcon />
              ログアウト
            </Button>
          </form>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
