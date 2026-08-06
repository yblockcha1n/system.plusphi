import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveProject } from "@/features/projects/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveProject(session, await readJson(request)));
}
