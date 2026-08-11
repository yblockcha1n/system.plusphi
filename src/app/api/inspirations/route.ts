import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveInspiration } from "@/features/inspirations/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveInspiration(session, await readJson(request)));
}
