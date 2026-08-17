import "server-only";
import { randomUUID } from "node:crypto";
import { parseDataUrl, putObject, removeObject, signObjects } from "@/lib/storage";

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
 * 撮った画像を先に保存し、読み取りに渡すための URL も一緒に返す。
 *
 * 読み取りへ画像そのものを送らず URL を渡すのが要点。実測で、Vercel の関数から
 * 180KB の本文を Perplexity へ送ると 100 秒経っても返らなかったのに対し、
 * URL（0.6KB）にすると 9 秒で返った。画像は Supabase から取りに行かせる。
 *
 * 保存先はランダムな名前にする。この時点では名刺の id がまだ無いため。
 *
 * @returns 保存できたらパスと署名付き URL。読めない・大きすぎるときは null。
 */
export async function stageCardImage(
  imageDataUrl: string
): Promise<{ path: string; url: string } | null> {
  const parsed = parseDataUrl(imageDataUrl, MAX_IMAGE_BYTES);
  if (!parsed) return null;

  const path = `${randomUUID()}.${parsed.extension}`;
  const stored = await putObject(CARD_BUCKET, path, parsed.buffer, parsed.contentType);

  if (!stored) return null;

  const signed = await signObjects(CARD_BUCKET, [stored]);
  const url = signed.get(stored);

  // 署名できなければ読み取りに渡せない。画像自体は残しておく。
  return url ? { path: stored, url } : null;
}

/** 保存済みの名刺画像を消す。本体を削除するときに呼ぶ。 */
export function deleteCardImage(path: string | null): Promise<void> {
  return removeObject(CARD_BUCKET, path);
}
