import { z } from "zod";

/**
 * サービス層 / Route Handler の戻り値。例外を投げずに「結果」として返す形で
 * 統一し、クライアントはこの形をそのまま画面表示に使う。
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const idleState: ActionState = { status: "idle" };

export function toErrorState(error: z.ZodError): ActionState {
  return {
    status: "error",
    message: "入力内容を確認してください。",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

/** 空文字を null に倒す任意入力。フォームは未入力を "" で送ってくるため。 */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

/** Select で「未選択」を表す番兵。DB では null。 */
export const NONE_VALUE = "__none__";

/** 番兵と空文字を null に倒したうえで uuid として検証する。 */
export const optionalUuid = z
  .string()
  .transform((value) => (value === NONE_VALUE || value === "" ? null : value))
  .pipe(z.uuid().nullable());

/** 番兵と空文字を null に倒したうえでメールアドレスとして検証する。 */
export const optionalEmail = z
  .string()
  .transform((value) => (value === NONE_VALUE || value === "" ? null : value))
  .pipe(z.email().nullable());

/** 並べ替えの結果として渡される id の配列。 */
export const orderedIds = z.array(z.uuid()).min(1).max(500);

/**
 * JSON ボディから文字列フィールドを1つ取り出す。
 *
 * 各スキーマは「未入力は空文字で届く」前提（フォーム由来）で書かれているので、
 * 欠けているキーや文字列以外は "" に倒して同じ前提を保つ。
 */
export function textField(input: unknown, key: string): string {
  if (typeof input !== "object" || input === null) return "";

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/** 省略可能な id。空なら undefined（= 新規作成）。 */
export function idField(input: unknown): string | undefined {
  return textField(input, "id") || undefined;
}
