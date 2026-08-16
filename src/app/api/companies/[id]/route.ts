import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteCompany, saveCompany } from "@/features/companies/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveCompany(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/companies/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteCompany(id));
}
