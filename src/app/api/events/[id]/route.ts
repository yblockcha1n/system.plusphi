import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteEvent, saveEvent } from "@/features/calendar/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async (session) =>
    saveEvent(session, { ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteEvent(id));
}
