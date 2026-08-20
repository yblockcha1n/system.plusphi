import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { updateBusinessCardStatus } from "@/features/business-cards/service";

/** 一覧から進み具合だけを切り替える。編集シートを開かずに済ませるため。 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/business-cards/[id]/status">
) {
  const { id } = await ctx.params;
  return withSession(request, async () => updateBusinessCardStatus(id, await readJson(request)));
}
