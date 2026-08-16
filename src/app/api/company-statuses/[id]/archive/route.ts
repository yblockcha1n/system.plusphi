import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { setCompanyStatusArchived } from "@/features/company-statuses/service";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/company-statuses/[id]/archive">) {
  const { id } = await ctx.params;
  return withSession(request, async () => setCompanyStatusArchived(id, await readJson(request)));
}
