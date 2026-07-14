import { cookies } from "next/headers";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/components/layout/sidebar-cookie";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <AppShell
      defaultCollapsed={collapsed}
      name={displayName(session.email) ?? session.email}
      email={session.email}
    >
      {children}
    </AppShell>
  );
}
