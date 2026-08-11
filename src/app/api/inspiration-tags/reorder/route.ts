import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { reorderInspirationTags } from "@/features/inspiration-tags/service";

export async function POST(request: NextRequest) {
  return withSession(request, async () => reorderInspirationTags(await readJson(request)));
}
