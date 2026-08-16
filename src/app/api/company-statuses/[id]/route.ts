import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteCompanyStatus, saveCompanyStatus } from "@/features/company-statuses/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/company-statuses/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveCompanyStatus(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/company-statuses/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteCompanyStatus(id));
}
