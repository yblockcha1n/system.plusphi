import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { skipEventOccurrence } from "@/features/calendar/service";

/** 繰り返しの予定から「この回だけ」を除外する。予定そのものは残る。 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/events/[id]/skip">) {
  const { id } = await ctx.params;
  return withSession(request, async () => skipEventOccurrence(id, await readJson(request)));
}
