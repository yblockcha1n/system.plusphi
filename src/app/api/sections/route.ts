import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveSection } from "@/features/credentials/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => saveSection(await readJson(request)));
}
