import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { reorderTaskTypes } from "@/features/task-types/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => reorderTaskTypes(await readJson(request)));
}
