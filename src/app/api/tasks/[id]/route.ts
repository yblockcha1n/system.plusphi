import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteTask, saveTask } from "@/features/tasks/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveTask(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/tasks/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteTask(id));
}
