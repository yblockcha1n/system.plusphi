import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { setTaskTypeArchived } from "@/features/task-types/service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/task-types/[id]/archive">) {
  const { id } = await ctx.params;
  return withSession(request, async () => setTaskTypeArchived(id, await readJson(request)));
}
