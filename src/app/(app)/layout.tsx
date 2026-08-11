import { cookies } from "next/headers";
import { requireSession } from "@/lib/dal";
import { displayName, env } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import {
  NAV_GROUPS_COOKIE,
  SIDEBAR_COOKIE,
  parseClosedGroups,
} from "@/components/layout/sidebar-cookie";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const cookieStore = await cookies();

  // 初期描画の時点で正しい状態にしておく（クライアントで直すとちらつく）
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const closedGroups = parseClosedGroups(cookieStore.get(NAV_GROUPS_COOKIE)?.value);

  return (
    <AppShell
      defaultCollapsed={collapsed}
      defaultClosedGroups={closedGroups}
      name={displayName(session.email) ?? session.email}
      email={session.email}
      // 公開鍵なのでクライアントへ渡してよい。未設定なら通知ボタンごと出さない。
      vapidPublicKey={env.VAPID_PUBLIC_KEY ?? null}
    >
      {children}
    </AppShell>
  );
}
