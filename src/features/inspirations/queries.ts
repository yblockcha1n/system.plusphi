import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { signThumbnails } from "@/features/inspirations/thumbnail";
import {
  toEmbedUrl,
  type ContentKind,
  type Platform,
  PLATFORMS,
  CONTENT_KINDS,
} from "@/features/inspirations/url";
import type { InspirationFilter, InspirationItem } from "@/features/inspirations/schema";

/** DB には自由文字列が入りうるため、既知のキー以外は倒す。 */
function toPlatform(value: string | null): Platform {
  return PLATFORMS.includes(value as Platform) ? (value as Platform) : "other";
}

function toContentKind(value: string | null): ContentKind {
  return CONTENT_KINDS.includes(value as ContentKind) ? (value as ContentKind) : "unknown";
}

/**
 * ナレッジ一覧。新しい順。
 *
 * タグの絞り込みは紐づけ表から先に id を引いてから本体を絞る。PostgREST の
 * 埋め込みリソースへのフィルタは書き方が読みにくいので、2 回に分けて素直に書く
 * （件数はたかが知れているので往復が増える不利より読みやすさを取る）。
 */
export async function getInspirations(
  filter: InspirationFilter = {}
): Promise<InspirationItem[]> {
  await requireSession();

  let matchedIds: string[] | null = null;

  if (filter.tagId) {
    const { data, error } = await supabase
      .from("inspiration_tag_links")
      .select("inspiration_id")
      .eq("tag_id", filter.tagId);

    if (error) {
      throw new Error(`タグの絞り込みに失敗しました: ${error.message}`);
    }

    matchedIds = data.map((row) => row.inspiration_id);

    // 該当が 0 件なら、この後の問い合わせは無駄なので打ち切る
    if (matchedIds.length === 0) return [];
  }

  let query = supabase.from("inspirations").select("*").order("created_at", { ascending: false });

  if (matchedIds) query = query.in("id", matchedIds);
  if (filter.platform) query = query.eq("platform", filter.platform);

  if (filter.keyword) {
    // PostgREST の or() では値中の "," と "." が区切りと紛らわしいので落とす
    const keyword = filter.keyword.replace(/[,.()]/g, " ").trim();

    if (keyword !== "") {
      const pattern = `%${keyword}%`;
      query = query.or(
        [`title.ilike.${pattern}`, `note.ilike.${pattern}`, `author_name.ilike.${pattern}`].join(",")
      );
    }
  }

  const [inspirationsResult, tagsResult] = await Promise.all([
    query,
    supabase.from("inspiration_tags").select("id, name"),
  ]);

  if (inspirationsResult.error) {
    throw new Error(`ナレッジの取得に失敗しました: ${inspirationsResult.error.message}`);
  }
  if (tagsResult.error) {
    throw new Error(`タグの取得に失敗しました: ${tagsResult.error.message}`);
  }

  const rows = inspirationsResult.data;
  if (rows.length === 0) return [];

  // 閉じたタグも含めて引く。過去に付けたタグ名は出したいため。
  const tagNames = new Map(tagsResult.data.map((row) => [row.id, row.name]));

  const [linksResult, signed] = await Promise.all([
    supabase
      .from("inspiration_tag_links")
      .select("inspiration_id, tag_id")
      .in(
        "inspiration_id",
        rows.map((row) => row.id)
      ),
    signThumbnails(rows.map((row) => row.thumbnail_path).filter((path): path is string => Boolean(path))),
  ]);

  if (linksResult.error) {
    throw new Error(`タグの取得に失敗しました: ${linksResult.error.message}`);
  }

  const linksByInspiration = new Map<string, string[]>();

  for (const link of linksResult.data) {
    const current = linksByInspiration.get(link.inspiration_id) ?? [];
    current.push(link.tag_id);
    linksByInspiration.set(link.inspiration_id, current);
  }

  return rows.map((row) => {
    const platform = toPlatform(row.platform);
    const contentKind = toContentKind(row.content_kind);
    const tagIds = linksByInspiration.get(row.id) ?? [];

    return {
      id: row.id,
      url: row.url,
      platform,
      contentKind,
      externalId: row.external_id,
      title: row.title,
      authorName: row.author_name,
      note: row.note,
      thumbnailUrl: row.thumbnail_path ? (signed.get(row.thumbnail_path) ?? null) : null,
      // url を渡すのはアカウントのため。ユーザー名は external_id ではなく
      // URL から読み直す（古い行は external_id が空なので）。
      embedUrl: toEmbedUrl(platform, contentKind, row.external_id, row.url),
      tagIds,
      tagNames: tagIds.map((id) => tagNames.get(id)).filter((name): name is string => Boolean(name)),
      createdBy: displayName(row.created_by),
      createdAt: row.created_at,
    };
  });
}
