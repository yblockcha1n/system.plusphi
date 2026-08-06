import "server-only";
import { compare } from "bcryptjs";
import { z } from "zod";
import { env, findAdminUser } from "@/lib/env";
import { createSessionCookie, deleteSessionCookie } from "@/lib/session";
import type { ActionState } from "@/lib/form";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// どちらが誤っているかを明かさない
const INVALID_CREDENTIALS = "メールアドレスまたはパスワードが正しくありません。";

/**
 * 認証してセッション Cookie を張る。
 * 画面遷移はここでは行わない（Route Handler の応答を見てクライアント側で遷移する）。
 */
export async function login(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  const { email, password } = parsed.data;
  const user = findAdminUser(email);

  // 未登録のメールアドレスでも必ず bcrypt 比較を1回走らせる（ダミーとして先頭ユーザーの
  // ハッシュを使う）。早期 return すると応答時間の差から「そのメールアドレスは登録されて
  // いるか」が漏れる。
  const passwordMatches = await compare(password, (user ?? env.ADMIN_USERS[0]).passwordHash);

  if (!user || !passwordMatches) {
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  await createSessionCookie({ sub: user.email, email: user.email });

  return { status: "success", message: "ログインしました。" };
}

export async function logout(): Promise<ActionState> {
  await deleteSessionCookie();
  return { status: "success", message: "ログアウトしました。" };
}
