import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/dal";
import type { SessionPayload } from "@/lib/session";
import type { ActionState } from "@/lib/form";

/**
 * Route Handler が返す本体。クライアント側は ActionState として扱うので、
 * フォームのエラー表示は Server Actions のときと同じコードが使える。
 */
export type ApiBody = ActionState & { data?: unknown };

export const ok = (message?: string, data?: unknown): ApiBody => ({
  status: "success",
  message,
  ...(data === undefined ? {} : { data }),
});

export const fail = (message: string, fieldErrors?: Record<string, string[]>): ApiBody => ({
  status: "error",
  message,
  ...(fieldErrors ? { fieldErrors } : {}),
});

/**
 * ブラウザからのクロスサイトリクエストを弾く。
 *
 * Server Actions は Next.js が Origin を検証してくれていたが、Route Handler には
 * その仕組みが無い。セッション Cookie は SameSite=lax なのでクロスサイトの
 * フォーム POST には載らないが、多層防御としてここでも確認する。
 *
 * Origin ヘッダーが無い場合は通す。ブラウザはクロスオリジンの
 * fetch / form POST で必ず Origin を付けるため、無いのは curl 等の
 * 「そもそも Cookie を自動送信しない」クライアントに限られる。
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return origin === null || origin === request.nextUrl.origin;
}

type Handler = (session: SessionPayload) => Promise<ApiBody>;

/**
 * 認証済みの API 用ラッパー。
 *
 * requireSession() は未認証時に /login へ redirect するが、fetch から見ると
 * 意図の分からない 307 になってしまうため、ここでは 401 を返す。
 */
export async function withSession(request: NextRequest, handler: Handler): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(fail("リクエスト元が不正です。"), { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(fail("セッションが切れました。再度ログインしてください。"), {
      status: 401,
    });
  }

  return respond(await handler(session));
}

/** 認証を要求しない API（ログイン）用。Origin の確認だけ行う。 */
export async function withoutSession(
  request: NextRequest,
  handler: () => Promise<ApiBody>
): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json(fail("リクエスト元が不正です。"), { status: 403 });
  }

  return respond(await handler());
}

function respond(body: ApiBody): NextResponse {
  return NextResponse.json(body, { status: body.status === "error" ? 400 : 200 });
}

/** JSON ボディを安全に読む。壊れていても例外にせず null を返す。 */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
