import type { NextRequest } from "next/server";
import { withSession } from "@/lib/api";
import { publishReleaseNote } from "@/features/release-notes/service";

/** 公開してから全員へ Push 通知を送る。押した人が誰かは publisher に残す。 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/release-notes/[id]/publish">) {
  const { id } = await ctx.params;
  return withSession(request, (session) => publishReleaseNote(session, id));
}
