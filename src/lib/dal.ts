import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/session";

/**
 * proxy.ts の判定は「楽観的チェック」にすぎない。データに触る処理
 * （Server Component / Server Action / Route Handler）は必ずここを通すこと。
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

export const requireSession = cache(async (): Promise<SessionPayload> => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return session;
});
