import "server-only";
import { supabase } from "@/lib/supabase";

/**
 * サムネイルの保管。
 *
 * 取得元の CDN URL をそのまま DB に持たない。Instagram のサムネ URL には有効期限
 * （oe= パラメータ）が入っていて、数週間で画像が出なくなるため。登録時に一度だけ
 * 取りに行き、自分のストレージへ複製する。
 *
 * バケットは非公開（0008 のマイグレーションで作成）。読み出しは署名付き URL で、
 * 他の画面と同じく「ログインした人だけが見られる」状態を保つ。
 */

const BUCKET = "inspiration-thumbnails";

/** 署名付き URL の寿命。画面を開いている間もつ程度あればよい。 */
const SIGNED_URL_TTL_SEC = 60 * 60;

/** 想定より大きい画像は落とさない（サムネなので数十 KB のはず）。 */
const MAX_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * サムネを取得してストレージへ保存する。
 *
 * @returns 保存できたら Storage 上のパス。取れなければ null。
 *          失敗しても登録そのものは通すので、例外は投げない。
 */
export async function storeThumbnail(
  inspirationId: string,
  sourceUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    const extension = EXTENSIONS[contentType];

    // 画像以外が返ってきたら保存しない（エラーページの HTML など）
    if (!extension) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return null;

    // 1 件につき 1 枚。再取得したら上書きする（古い世代を溜めない）。
    const path = `${inspirationId}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.error("[inspirations] サムネの保存に失敗しました", {
        inspirationId,
        message: error.message,
      });
      return null;
    }

    return path;
  } catch (cause) {
    console.error("[inspirations] サムネの取得に失敗しました", {
      inspirationId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/** 保存済みのサムネを消す。本体を削除するときに呼ぶ。 */
export async function deleteThumbnail(path: string | null): Promise<void> {
  if (!path) return;

  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    // 残っても表示に影響は無い。ストレージが少し無駄になるだけ。
    console.error("[inspirations] サムネの削除に失敗しました", { path, message: error.message });
  }
}

/**
 * 一覧に出すための署名付き URL をまとめて作る。
 *
 * 1 件ずつ発行すると件数ぶん往復するので、createSignedUrls でまとめて取る。
 * 発行できなかったぶんは Map に入らない（画面はサムネ無しとして描く）。
 */
export async function signThumbnails(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const signed = new Map<string, string>();

  if (unique.length === 0) return signed;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC);

  if (error || !data) {
    console.error("[inspirations] サムネの署名に失敗しました", { message: error?.message });
    return signed;
  }

  for (const item of data) {
    if (item.signedUrl && item.path) signed.set(item.path, item.signedUrl);
  }

  return signed;
}
