import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { readJson } from "@/lib/api";
import { getDraftBaseSha, saveReleaseNoteDraft } from "@/features/release-notes/service";

/**
 * GitHub Actions からの受け口。
 *
 * セッションを持たないので RELEASE_NOTES_SECRET だけが正当性の根拠になる。
 * proxy.ts の matcher は /api/ を除外しているため、ここは素通しで到達する。
 * 認証方式は /api/cron/notify と揃えてある。
 */
function isAuthorized(request: NextRequest): boolean {
  if (!env.RELEASE_NOTES_SECRET) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(env.RELEASE_NOTES_SECRET);

  // timingSafeEqual は長さが違うと例外を投げるので、先に長さを見る
  return a.length === b.length && timingSafeEqual(a, b);
}

/** CI が差分を取る起点（前回公開時の HEAD）を教える。 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ status: "success", baseSha: await getDraftBaseSha() });
}

/** 生成された下書きを登録する。未公開の下書きがあれば作り直す。 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: "error", message: "unauthorized" }, { status: 401 });
  }

  const result = await saveReleaseNoteDraft(await readJson(request));

  return NextResponse.json(result, { status: result.status === "error" ? 400 : 200 });
}
