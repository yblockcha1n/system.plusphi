import type { NextRequest } from "next/server";
import { readJson, withoutSession } from "@/lib/api";
import { login } from "@/features/auth/service";

/** 未認証で叩く唯一の API。proxy.ts の matcher から /api/ は除外してある。 */
export async function POST(request: NextRequest) {
  return withoutSession(request, async () => login(await readJson(request)));
}
