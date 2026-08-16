import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteBusinessCard, saveBusinessCard } from "@/features/business-cards/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/business-cards/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveBusinessCard(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/business-cards/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteBusinessCard(id));
}
