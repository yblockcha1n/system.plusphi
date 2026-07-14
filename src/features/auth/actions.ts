"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env, findAdminUser } from "@/lib/env";
import { createSessionCookie, deleteSessionCookie } from "@/lib/session";

export type LoginState = {
  error?: string;
};

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// どちらが誤っているかを明かさない
const INVALID_CREDENTIALS = "メールアドレスまたはパスワードが正しくありません。";

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: INVALID_CREDENTIALS };
  }

  const { email, password } = parsed.data;
  const user = findAdminUser(email);

  // 未登録のメールアドレスでも必ず bcrypt 比較を1回走らせる（ダミーとして先頭ユーザーの
  // ハッシュを使う）。早期 return すると応答時間の差から「そのメールアドレスは登録されて
  // いるか」が漏れる。
  const passwordMatches = await compare(password, (user ?? env.ADMIN_USERS[0]).passwordHash);

  if (!user || !passwordMatches) {
    return { error: INVALID_CREDENTIALS };
  }

  await createSessionCookie({ sub: user.email, email: user.email });

  redirect("/credentials");
}

export async function logout(): Promise<void> {
  await deleteSessionCookie();
  redirect("/login");
}
