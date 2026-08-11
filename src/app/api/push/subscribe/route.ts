import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteSubscription, saveSubscription } from "@/features/push/service";

/**
 * 端末の購読を登録する。Service Worker の pushsubscriptionchange からも呼ぶため、
 * ブラウザの画面以外からのリクエストもここを通る（同一オリジンの確認は withSession）。
 */
export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent");

  return withSession(request, async (session) =>
    saveSubscription(session, await readJson(request), userAgent)
  );
}

export async function DELETE(request: NextRequest) {
  return withSession(request, async () => deleteSubscription(await readJson(request)));
}
