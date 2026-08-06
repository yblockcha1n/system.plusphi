import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveEvent } from "@/features/calendar/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveEvent(session, await readJson(request)));
}
