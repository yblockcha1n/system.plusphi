import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteSection, saveSection } from "@/features/credentials/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/sections/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async () => saveSection({ ...(await readJson(request) as object), id }));
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/sections/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteSection(id));
}
