import "server-only";
import { putObject, removeObject } from "@/lib/storage";
import { parseDataUrl } from "@/lib/storage";

/** 名刺画像の置き場。個人情報なので非公開バケット（0010 で作成）。 */
export const CARD_BUCKET = "business-cards";

/**
 * 受け取れる画像の上限。
 *
 * ブラウザ側で長辺 1600px・JPEG 品質 0.82 に縮小してから送る前提で、
 * 実際は 150〜400KB に収まる。ここは「明らかにおかしいものを弾く」ための値。
 * Vercel のリクエストボディ上限（4.5MB・変更不可）より内側に置く。
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/**
 * データ URI で受け取った名刺画像を保存する。
 *
 * @returns 保存できたら Storage 上のパス。読めない・大きすぎるときは null。
 *          画像が保存できなくても名刺そのものは登録したいので例外は投げない。
 */
export async function storeCardImage(
  cardId: string,
  imageDataUrl: string
): Promise<string | null> {
  const parsed = parseDataUrl(imageDataUrl, MAX_IMAGE_BYTES);
  if (!parsed) return null;

  return putObject(
    CARD_BUCKET,
    `${cardId}.${parsed.extension}`,
    parsed.buffer,
    parsed.contentType
  );
}

/** 保存済みの名刺画像を消す。本体を削除するときに呼ぶ。 */
export function deleteCardImage(path: string | null): Promise<void> {
  return removeObject(CARD_BUCKET, path);
}
