import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { updateTaskStatus } from "@/features/tasks/service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]/status">) {
  const { id } = await ctx.params;
  return withSession(request, async () => updateTaskStatus(id, await readJson(request)));
}
