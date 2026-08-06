import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { reorderProjects } from "@/features/projects/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => reorderProjects(await readJson(request)));
}
