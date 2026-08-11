import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveTaskType } from "@/features/task-types/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveTaskType(session, await readJson(request)));
}
