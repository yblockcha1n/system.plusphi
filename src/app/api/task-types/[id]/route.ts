import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteTaskType, saveTaskType } from "@/features/task-types/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/task-types/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveTaskType(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/task-types/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteTaskType(id));
}
