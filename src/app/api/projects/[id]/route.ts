import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteProject, saveProject } from "@/features/projects/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveProject(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteProject(id));
}
