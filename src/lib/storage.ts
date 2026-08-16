import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * Supabase Storage への保存・削除・読み出し。
 *
 * バケットはどれも非公開にしてある。公開バケットにすると URL を知っている誰でも
 * 見られてしまい、ログインを前提にした他の画面と方針が食い違うため。
 * 読み出しは必ず署名付き URL を都度発行する。
 *
 * ナレッジのサムネ用に書いたものを、名刺画像でも使えるよう一般化した。
 */

/** 署名付き URL の寿命。画面を開いている間もつ程度あればよい。 */
const SIGNED_URL_TTL_SEC = 60 * 60;

export const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * バイト列を保存する。
 *
 * @returns 保存できたら Storage 上のパス。できなければ null。
 *          呼び出し側の処理（登録そのもの）は続けたいので例外は投げない。
 */
export async function putObject(
  bucket: string,
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<string | null> {
  // 1 件につき 1 枚。撮り直したら上書きする（古い世代を溜めない）。
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  });

  if (error) {
    console.error("[storage] 保存に失敗しました", { bucket, path, message: error.message });
    return null;
  }

  return path;
}

/**
 * URL から取得して保存する。取得できない・画像でない場合は保存しない。
 *
 * @param maxBytes 想定より大きいものは落とさないための上限。
 */
export async function putObjectFromUrl(
  bucket: string,
  basePath: string,
  sourceUrl: string,
  maxBytes: number
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = EXTENSION_BY_MIME[contentType];

    // 画像以外が返ってきたら保存しない（エラーページの HTML など）
    if (!extension) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return null;

    return putObject(bucket, `${basePath}.${extension}`, buffer, contentType);
  } catch (cause) {
    console.error("[storage] 取得に失敗しました", {
      bucket,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/** 保存済みのオブジェクトを消す。本体を削除するときに呼ぶ。 */
export async function removeObject(bucket: string, path: string | null): Promise<void> {
  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    // 残っても表示に影響は無い。ストレージが少し無駄になるだけ。
    console.error("[storage] 削除に失敗しました", { bucket, path, message: error.message });
  }
}

/**
 * 一覧に出すための署名付き URL をまとめて作る。
 *
 * 1 件ずつ発行すると件数ぶん往復するので createSignedUrls でまとめて取る。
 * 発行できなかったぶんは Map に入らない（画面は画像無しとして描く）。
 */
export async function signObjects(
  bucket: string,
  paths: (string | null)[]
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const signed = new Map<string, string>();

  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC);

  if (error || !data) {
    console.error("[storage] 署名に失敗しました", { bucket, message: error?.message });
    return signed;
  }

  for (const item of data) {
    if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
  }

  return signed;
}

/**
 * データ URI（data:image/jpeg;base64,...）を読み解く。
 *
 * ブラウザで縮小した画像をそのまま JSON で受け取るため。Vercel のボディ上限が
 * 4.5MB で変更できないので、呼び出し側は必ず上限を渡して弾けるようにしておく。
 */
export function parseDataUrl(
  value: unknown,
  maxBytes: number
): { buffer: Buffer; contentType: string; extension: string } | null {
  if (typeof value !== "string") return null;

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value.trim());
  if (!match) return null;

  const contentType = match[1];
  const extension = EXTENSION_BY_MIME[contentType];
  if (!extension) return null;

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return null;

  return { buffer, contentType, extension };
}
