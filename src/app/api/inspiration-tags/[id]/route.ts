import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteInspirationTag, saveInspirationTag } from "@/features/inspiration-tags/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/inspiration-tags/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveInspirationTag(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/inspiration-tags/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteInspirationTag(id));
}
