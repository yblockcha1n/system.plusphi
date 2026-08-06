import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, findAdminUser } from "@/lib/env";

export const SESSION_COOKIE = "plusphi_session";
// 社内の限られた端末からしか使わないため、再ログインの手間を優先して長めに取る。
// ADMIN_USERS から外した利用者は verifySessionToken 側で即座に弾かれるので、
// 期限が長くても「退職者が1ヶ月使い続けられる」ことにはならない。
const SESSION_DURATION_SEC = 60 * 60 * 24 * 30; // 30日

const encodedKey = new TextEncoder().encode(env.SESSION_SECRET);

export type SessionPayload = {
  sub: string;
  email: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(encodedKey);
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      return null;
    }

    // env から外された利用者のトークンは、期限内でも即座に無効になる
    if (!findAdminUser(payload.email)) {
      return null;
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SEC,
  });
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
