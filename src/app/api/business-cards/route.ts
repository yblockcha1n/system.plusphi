import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveBusinessCard } from "@/features/business-cards/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) =>
    saveBusinessCard(session, await readJson(request))
  );
}
