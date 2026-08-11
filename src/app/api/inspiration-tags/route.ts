import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveInspirationTag } from "@/features/inspiration-tags/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) =>
    saveInspirationTag(session, await readJson(request))
  );
}
