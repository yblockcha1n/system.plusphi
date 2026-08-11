import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { deleteReleaseNote, saveReleaseNote } from "@/features/release-notes/service";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/release-notes/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, async () =>
    saveReleaseNote({ ...(await readJson(request) as object), id })
  );
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/release-notes/[id]">) {
  const { id } = await ctx.params;
  return withSession(request, () => deleteReleaseNote(id));
}
