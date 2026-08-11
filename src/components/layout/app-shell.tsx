"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { LogOutIcon, MenuIcon, PanelLeftIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useApiMutation } from "@/components/shared/use-api";
import { findNavItem } from "@/components/layout/nav-items";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import {
  NAV_GROUPS_COOKIE,
  SIDEBAR_COOKIE,
  writeSidebarCookie,
} from "@/components/layout/sidebar-cookie";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationToggle } from "@/components/pwa/notification-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { run: runLogout, pending: loggingOut } = useApiMutation();

  // 画面が変わったらドロワーを閉じる。開いたままだと遷移先が隠れてしまう。
  // （effect ではなくレンダー中に追随させる: react.dev/learn/you-might-not-need-an-effect）
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

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

  const userInfo = (
    <div className="border-t p-3">
      <p className="truncate text-sm font-medium">{name}</p>
      <p className="truncate text-xs text-muted-foreground" title={email}>
        {email}
      </p>
    </div>
  );

  return (
    // h-svh + overflow-hidden にすることで、スクロールを main の中に閉じ込める。
    // テーブルのヘッダー固定はこれが前提。
    // ライトは薄いグレーの下地。ダークは漆黒にしたいので muted を敷かない。
    // safe-bottom: ホーム画面から起動したとき、内容がホームインジケーターに
    // 潜り込まないよう全体を持ち上げる。
    <div className="safe-bottom flex h-svh overflow-hidden bg-muted/40 dark:bg-background">
      {/* デスクトップの固定サイドバー。モバイルは同じ中身をドロワーで出す。 */}
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

        <SidebarNav
          collapsed={collapsed}
          closedGroups={closedGroups}
          onToggleGroup={toggleGroup}
          isActive={isActive}
        />

        {!collapsed && userInfo}
      </aside>

      {/* モバイルのドロワー。中身はデスクトップのサイドバーと同じ SidebarNav。 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          // 既定は画面いっぱいだが、ナビは脇から出す幅で十分。
          // 変則的な指定に見えるが、ui/sheet.tsx と同じ条件で書かないと
          // tailwind-merge が競合として解決できず幅が上書きされない。
          className="w-72 gap-0 data-[side=left]:w-72 sm:data-[side=left]:w-72 sm:data-[side=left]:max-w-none sm:data-[side=left]:min-w-0"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <BrandMark className="size-8" size={18} />
              plusphi
            </SheetTitle>
            <SheetDescription className="sr-only">
              画面を切り替えるメニューです。
            </SheetDescription>
          </SheetHeader>

          <SidebarNav
            collapsed={false}
            closedGroups={closedGroups}
            onToggleGroup={toggleGroup}
            isActive={isActive}
          />

          {userInfo}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-4">
          {/* モバイルはドロワーを開く。デスクトップは幅の折りたたみ。 */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDrawerOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={drawerOpen}
            className="lg:hidden"
          >
            <MenuIcon />
          </Button>

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
      </div>
    </div>
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
