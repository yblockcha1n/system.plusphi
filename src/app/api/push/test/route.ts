import type { NextRequest } from "next/server";
import { withSession } from "@/lib/api";
import { sendTestNotification } from "@/features/push/service";

/** 自分あてにテスト通知を 1 通送る。設定できているかを利用者自身が確かめるため。 */
export async function POST(request: NextRequest) {
  return withSession(request, (session) => sendTestNotification(session));
}
