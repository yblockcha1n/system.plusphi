import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { setInspirationTagArchived } from "@/features/inspiration-tags/service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/inspiration-tags/[id]/archive">) {
  const { id } = await ctx.params;
  return withSession(request, async () => setInspirationTagArchived(id, await readJson(request)));
}
