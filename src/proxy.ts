import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const LOGIN_PATH = "/login";
const HOME_PATH = "/credentials";

/**
 * Next.js 16 で middleware は proxy にリネームされ、Node.js ランタイム固定になった。
 * ここでの判定は楽観的チェック（Cookie の JWT を検証するだけ）で、DB は触らない。
 * 実際の認可は各 Server Component / Server Action の requireSession() が担う。
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  const { pathname } = request.nextUrl;

  if (pathname === LOGIN_PATH) {
    if (session) {
      return NextResponse.redirect(new URL(HOME_PATH, request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL(LOGIN_PATH, request.nextUrl);
    const response = NextResponse.redirect(loginUrl);

    // 期限切れトークンを持ち回らせない
    if (token) {
      response.cookies.delete(SESSION_COOKIE);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
