import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { reorderTasks } from "@/features/tasks/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => reorderTasks(await readJson(request)));
}
