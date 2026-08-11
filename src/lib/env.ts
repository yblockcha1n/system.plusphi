import "server-only";
import { z } from "zod";
import { colorFromSeed, type AccentColor } from "@/lib/colors";

const base64Bytes = (value: string) => Buffer.from(value, "base64").length;

export type AdminUser = {
  email: string;
  passwordHash: string;
  /** 画面に出す表示名（例: 渡邉）。省略時はメールアドレスを表示する。 */
  name: string;
  /**
   * カレンダーを「担当者」で色分けするときの識別色。
   * env には書かせず、メールアドレスから導出する（誰にでも必ず色が付く）。
   */
  color: AccentColor;
};

/**
 * ADMIN_USERS は "メールアドレス:bcryptハッシュのbase64:表示名" をカンマ区切りで並べたもの。
 * base64 の文字集合には ":" も "," も含まれないため、区切りが曖昧にならない。
 *
 * ハッシュを base64 で持つ理由: 生の "$2b$12$..." を .env に置くと Next.js の dotenv が
 * "$2b" などを変数展開して値を壊す（Vercel 側は展開しないため、ローカルだけ壊れるという
 * 厄介な差異になる）。base64 なら両環境で同じ値がそのまま使える。
 */
const adminUsers = z
  .string()
  .min(1)
  .transform((raw, ctx): AdminUser[] => {
    const users: AdminUser[] = [];

    for (const entry of raw.split(",").map((value) => value.trim()).filter(Boolean)) {
      const [rawEmail, rawHash, rawName] = entry.split(":");

      if (!rawEmail || !rawHash) {
        ctx.addIssue(
          `"${entry}" の形式が不正です（メールアドレス:ハッシュ:表示名 の形で指定してください）`
        );
        continue;
      }

      const email = rawEmail.trim().toLowerCase();
      const passwordHash = Buffer.from(rawHash.trim(), "base64").toString("utf8");

      if (!z.email().safeParse(email).success) {
        ctx.addIssue(`"${email}" はメールアドレスとして不正です`);
        continue;
      }

      if (!/^\$2[aby]\$/.test(passwordHash)) {
        ctx.addIssue(`${email} のハッシュが不正です（npm run hash-password で生成してください）`);
        continue;
      }

      users.push({
        email,
        passwordHash,
        name: rawName?.trim() || email,
        color: colorFromSeed(email),
      });
    }

    if (users.length === 0) {
      ctx.addIssue("利用者を最低1人は指定してください");
    }

    return users;
  });

/**
 * Push 通知まわりは「任意」にしてある。
 *
 * 必須にすると、鍵を設定する前にデプロイした瞬間にアプリ全体が起動しなくなる。
 * 通知が使えないのと基幹システムが落ちるのとでは影響がまるで違うので、
 * 未設定なら通知機能だけを黙って無効にする（isPushConfigured で判定）。
 */
const optionalSecret = z.string().min(1).optional();

const envSchema = z.object({
  ADMIN_USERS: adminUsers,
  SESSION_SECRET: z.string().min(32, "32文字以上にしてください（openssl rand -base64 32）"),
  ENCRYPTION_KEY: z
    .string()
    .refine((value) => base64Bytes(value) === 32, "base64 で 32 バイトの鍵を指定してください（openssl rand -base64 32）"),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // npm run generate-vapid で作る
  VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  /** 送信元の連絡先。push サービスが配信を止めたいときに使う。 */
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@plusphi.jp"),
  /** Supabase Cron から /api/cron/* を叩くときの合言葉。 */
  CRON_SECRET: optionalSecret,
  /** GitHub Actions からパッチノートの下書きを投げるときの合言葉。 */
  RELEASE_NOTES_SECRET: optionalSecret,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`環境変数が不正です。.env.example を参照してください。\n${detail}`);
}

export const env = parsed.data;

/** VAPID 鍵が揃っているか。揃っていなければ通知の購読も送信も行わない。 */
export function isPushConfigured(): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function findAdminUser(email: string): AdminUser | undefined {
  const normalized = email.trim().toLowerCase();
  return env.ADMIN_USERS.find((user) => user.email === normalized);
}

/** 担当者 / 検収者の選択肢。ハッシュは絶対に含めない（クライアントへ渡すため）。 */
export type UserOption = { email: string; name: string; color: AccentColor };

export function listUsers(): UserOption[] {
  return env.ADMIN_USERS.map(({ email, name, color }) => ({ email, name, color }));
}

/**
 * メールアドレスを表示名に解決する。ADMIN_USERS から外れた利用者が登録した行も
 * 残るため、その場合はメールアドレスをそのまま返す。
 */
export function displayName(email: string | null): string | null {
  if (!email) return null;
  return findAdminUser(email)?.name ?? email;
}

/**
 * メールアドレスを識別色に解決する。displayName と同じく、ADMIN_USERS から外れた
 * 利用者の行も残るため、その場合も同じ導出で色を返す（凡例には出ないが色は付く）。
 * 担当者が未設定のときだけ gray = 「未割当」になる。
 */
export function userColor(email: string | null): AccentColor {
  if (!email) return "gray";
  return findAdminUser(email)?.color ?? colorFromSeed(email.trim().toLowerCase());
}
