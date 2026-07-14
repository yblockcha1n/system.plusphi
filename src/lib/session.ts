import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env, findAdminUser } from "@/lib/env";

export const SESSION_COOKIE = "plusphi_session";
const SESSION_DURATION_SEC = 60 * 60 * 8; // 8時間

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
