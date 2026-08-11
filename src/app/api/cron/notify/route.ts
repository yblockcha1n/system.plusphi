import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env, isPushConfigured } from "@/lib/env";
import { runScheduledNotifications } from "@/features/push/scheduled";

/**
 * 定期通知（締切・予定の開始前）の実行口。Supabase Cron（pg_cron + pg_net）から
 * 5 分ごとに叩かれる。設定手順は supabase/cron/schedule.sql を参照。
 *
 * セッションは持たないので、CRON_SECRET だけが正当性の根拠になる。
 * proxy.ts の matcher は /api/ を除外しているため、ここは素通しで到達する。
 */

/** 長さの違いも含めて時間差が出ないように比較する。 */
function isAuthorized(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;

  // Vercel Cron は Authorization、pg_net からは同じ形で送るよう schedule.sql で揃える
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(env.CRON_SECRET);

  // timingSafeEqual は長さが違うと例外を投げるので、先に長さを揃えて比較する
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  }

  if (!isPushConfigured()) {
    return NextResponse.json(
      { status: "error", message: "VAPID キーが設定されていません。" },
      { status: 503 }
    );
  }

  const result = await runScheduledNotifications();

  // 送信件数を返す。pg_net の応答は net._http_response に残るので、
  // うまく動いているかを SQL から確認できる。
  return NextResponse.json({ status: "success", ...result });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

/** 手元から curl で叩いて確かめられるように GET も受ける。 */
export async function GET(request: NextRequest) {
  return handle(request);
}
