import type { NextRequest } from "next/server";
import { withSession } from "@/lib/api";
import { refreshInspiration } from "@/features/inspirations/service";

/** サムネ・タイトル・投稿者を取り直す。取得元の仕様変更で欠けたときの復旧用。 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/inspirations/[id]/refresh">) {
  const { id } = await ctx.params;
  return withSession(request, () => refreshInspiration(id));
}
