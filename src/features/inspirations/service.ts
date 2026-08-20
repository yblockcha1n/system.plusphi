import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { idField, textField, toErrorState, type ActionState } from "@/lib/form";
import { inspirationFormSchema } from "@/features/inspirations/schema";
import { fetchMetadata } from "@/features/inspirations/metadata";
import { deleteThumbnail, storeThumbnail } from "@/features/inspirations/thumbnail";
import { parseInspirationUrl } from "@/features/inspirations/url";
import type { SessionPayload } from "@/lib/session";

const KNOWLEDGE_PATH = "/inspirations";

export async function saveInspiration(
  session: SessionPayload,
  input: unknown
): Promise<ActionState> {
  const parsed = inspirationFormSchema.safeParse({
    id: idField(input),
    url: textField(input, "url"),
    title: textField(input, "title"),
    note: textField(input, "note"),
    authorName: textField(input, "authorName"),
    tagIds: textField(input, "tagIds"),
  });

  if (!parsed.success) {
    return toErrorState(parsed.error);
  }

  const { id, url, title, note, authorName, tagIds } = parsed.data;

  // refine を通っているので必ず解析できる
  const analyzed = parseInspirationUrl(url);
  if (!analyzed) {
    return { status: "error", message: "URL を解析できませんでした。" };
  }

  // 外部から取れるものを取りに行く。失敗しても登録は続ける。
  const metadata = await fetchMetadata(analyzed);
  // 短縮 URL を展開できたら、そちらを正とする
  const resolved = metadata.resolved ?? analyzed;

  const values = {
    url: resolved.canonicalUrl,
    platform: resolved.platform,
    content_kind: resolved.contentKind,
    external_id: resolved.externalId,
    // 手入力があればそれを優先する（自動取得は補助）
    title: title ?? metadata.title,
    author_name: authorName ?? metadata.authorName ?? resolved.authorName,
    note,
  };

  const { data, error } = id
    ? await supabase.from("inspirations").update(values).eq("id", id).select("id").single()
    : await supabase
        .from("inspirations")
        .insert({ ...values, created_by: session.email })
        .select("id")
        .single();

  if (error) {
    // 23505 = unique_violation。同じ投稿を二度溜めても意味が無いので弾く。
    if (error.code === "23505") {
      return {
        status: "error",
        message: "この URL は既に登録されています。",
        fieldErrors: { url: ["登録済みです"] },
      };
    }

    return { status: "error", message: `保存に失敗しました: ${error.message}` };
  }

  await Promise.all([
    replaceTags(data.id, tagIds),
    // サムネは取れたときだけ差し替える。取れなくても既存のものは残す。
    metadata.thumbnailUrl ? saveThumbnail(data.id, metadata.thumbnailUrl) : Promise.resolve(),
  ]);

  revalidatePath(KNOWLEDGE_PATH);

  return {
    status: "success",
    message: id ? "ナレッジを更新しました。" : "ナレッジを登録しました。",
  };
}

/**
 * メタ情報を取り直す。
 *
 * Instagram のサムネ取得は HTML の構造に依存していて壊れうるので、直ったときに
 * 手動でやり直せる口を用意しておく。手入力されたタイトルは上書きしない。
 */
export async function refreshInspiration(inspirationId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(inspirationId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { data: row, error: readError } = await supabase
    .from("inspirations")
    .select("id, url, title, author_name")
    .eq("id", parsed.data)
    .maybeSingle();

  if (readError || !row) {
    return { status: "error", message: "対象が見つかりませんでした。" };
  }

  const analyzed = parseInspirationUrl(row.url);
  if (!analyzed) {
    return { status: "error", message: "URL を解析できませんでした。" };
  }

  const metadata = await fetchMetadata(analyzed);

  const resolved = metadata.resolved ?? analyzed;

  if (!metadata.thumbnailUrl && !metadata.title && !metadata.authorName && !metadata.resolved) {
    return {
      status: "error",
      message: "取得できませんでした。非公開の投稿か、削除されている可能性があります。",
    };
  }

  const { error } = await supabase
    .from("inspirations")
    .update({
      // 既に入っている値は消さない（手で直したものを上書きしないため）
      title: row.title ?? metadata.title,
      author_name: row.author_name ?? metadata.authorName,
      // 見せ方は取り直す。Web ページが埋め込みを許可し始める／やめることがあり、
      // 種類を持たずに登録された古い行もここで拾える。
      content_kind: resolved.contentKind,
    })
    .eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `更新に失敗しました: ${error.message}` };
  }

  if (metadata.thumbnailUrl) {
    await saveThumbnail(parsed.data, metadata.thumbnailUrl);
  }

  revalidatePath(KNOWLEDGE_PATH);
  return { status: "success", message: "最新の情報を取得しました。" };
}

export async function deleteInspiration(inspirationId: string): Promise<ActionState> {
  const parsed = z.uuid().safeParse(inspirationId);
  if (!parsed.success) {
    return { status: "error", message: "不正なリクエストです。" };
  }

  const { data: row } = await supabase
    .from("inspirations")
    .select("thumbnail_path")
    .eq("id", parsed.data)
    .maybeSingle();

  // 紐づけは on delete cascade で一緒に消える
  const { error } = await supabase.from("inspirations").delete().eq("id", parsed.data);

  if (error) {
    return { status: "error", message: `削除に失敗しました: ${error.message}` };
  }

  // ストレージは外部キーで消えないので自分で片付ける
  await deleteThumbnail(row?.thumbnail_path ?? null);

  revalidatePath(KNOWLEDGE_PATH);
  return { status: "success", message: "ナレッジを削除しました。" };
}

/* ------------------------------ 内部処理 ------------------------------ */

/** タグの紐づけを入れ替える。差分を取らず、消してから入れ直す（件数が少ないため）。 */
async function replaceTags(inspirationId: string, tagIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from("inspiration_tag_links")
    .delete()
    .eq("inspiration_id", inspirationId);

  if (deleteError) {
    console.error("[inspirations] タグの更新に失敗しました", {
      inspirationId,
      message: deleteError.message,
    });
    return;
  }

  if (tagIds.length === 0) return;

  const { error } = await supabase
    .from("inspiration_tag_links")
    .insert(tagIds.map((tagId) => ({ inspiration_id: inspirationId, tag_id: tagId })));

  if (error) {
    console.error("[inspirations] タグの付与に失敗しました", {
      inspirationId,
      message: error.message,
    });
  }
}

/** サムネを保存し、保存できたらパスを本体に書き戻す。 */
async function saveThumbnail(inspirationId: string, sourceUrl: string): Promise<void> {
  const path = await storeThumbnail(inspirationId, sourceUrl);
  if (!path) return;

  await supabase.from("inspirations").update({ thumbnail_path: path }).eq("id", inspirationId);
}
