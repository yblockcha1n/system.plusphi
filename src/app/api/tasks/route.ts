import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveTask } from "@/features/tasks/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveTask(session, await readJson(request)));
}
