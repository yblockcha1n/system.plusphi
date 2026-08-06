import type { NextRequest } from "next/server";
import { withoutSession } from "@/lib/api";
import { logout } from "@/features/auth/service";

// セッションが既に切れていても Cookie は消したいので withoutSession を使う
export async function POST(request: NextRequest) {
  return withoutSession(request, logout);
}
