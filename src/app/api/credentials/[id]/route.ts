import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteCredential, saveCredential } from "@/features/credentials/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/credentials/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveCredential(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/credentials/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteCredential(id));
}
