import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { revealSecret } from "@/features/credentials/service";

/**
 * 平文を返す唯一の経路。GET にすると URL や履歴に残りやすいため POST にしている。
 * 誰が見たかを監査ログに残すため、セッションをサービス層まで渡す。
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/credentials/[id]/reveal">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    revealSecret(session, id, await readJson(request))
  );
}
