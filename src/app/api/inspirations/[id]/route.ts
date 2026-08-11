import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteInspiration, saveInspiration } from "@/features/inspirations/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/inspirations/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveInspiration(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/inspirations/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteInspiration(id));
}
