import "server-only";
import { putObjectFromUrl, removeObject, signObjects } from "@/lib/storage";

/**
 * ナレッジのサムネイル。
 *
 * 取得元の CDN URL をそのまま DB に持たない。Instagram のサムネ URL には有効期限
 * （oe= パラメータ）が入っていて、数週間で画像が出なくなるため。登録時に一度だけ
 * 取りに行き、自分のストレージへ複製する。
 *
 * 保存・削除・署名の処理そのものは lib/storage.ts が持つ（名刺画像でも使うため）。
 */

const BUCKET = "inspiration-thumbnails";

/** 想定より大きい画像は落とさない（サムネなので数十 KB のはず）。 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * サムネを取得してストレージへ保存する。
 *
 * @returns 保存できたら Storage 上のパス。取れなければ null。
 *          失敗しても登録そのものは通すので、例外は投げない。
 */
export function storeThumbnail(
  inspirationId: string,
  sourceUrl: string
): Promise<string | null> {
  return putObjectFromUrl(BUCKET, inspirationId, sourceUrl, MAX_BYTES);
}

/** 保存済みのサムネを消す。本体を削除するときに呼ぶ。 */
export function deleteThumbnail(path: string | null): Promise<void> {
  return removeObject(BUCKET, path);
}

/** 一覧に出すための署名付き URL をまとめて作る。 */
export function signThumbnails(paths: string[]): Promise<Map<string, string>> {
  return signObjects(BUCKET, paths);
}
