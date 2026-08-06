import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { setProjectArchived } from "@/features/projects/service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/archive">) {
  const { id } = await ctx.params;
  return withSession(request, async () => setProjectArchived(id, await readJson(request)));
}
