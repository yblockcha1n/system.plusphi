import type { NextRequest } from "next/server";
import { readJson, withSession } from "@/lib/api";
import { saveCredential } from "@/features/credentials/service";

export async function POST(request: NextRequest) {
  return withSession(request, async (session) => saveCredential(session, await readJson(request)));
}
