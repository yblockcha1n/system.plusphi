import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type {
  InspirationTagItem,
  InspirationTagOption,
} from "@/features/inspiration-tags/schema";

/** マスタ管理画面用。閉じたものも含めて全件を、利用件数つきで返す。 */
export async function getInspirationTags(): Promise<InspirationTagItem[]> {
  await requireSession();

  const [tagsResult, linksResult] = await Promise.all([
    supabase.from("inspiration_tags").select("*").order("sort_order").order("created_at"),
    supabase.from("inspiration_tag_links").select("tag_id"),
  ]);

  if (tagsResult.error) {
    throw new Error(`タグの取得に失敗しました: ${tagsResult.error.message}`);
  }
  if (linksResult.error) {
    throw new Error(`タグの集計に失敗しました: ${linksResult.error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of linksResult.data) {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }

  return tagsResult.data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdBy: displayName(row.created_by),
    usageCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * 登録フォームと絞り込みに出す選択肢。閉じたタグは出さない。
 *
 * 編集中の投稿に閉じたタグが付いている場合は画面側で現在値を足す
 * （task-sheet と同じ考え方）。
 */
export async function getInspirationTagOptions(): Promise<InspirationTagOption[]> {
  await requireSession();

  const { data, error } = await supabase
    .from("inspiration_tags")
    .select("id, name, archived_at")
    .order("sort_order")
    .order("created_at");

  if (error) {
    throw new Error(`タグの取得に失敗しました: ${error.message}`);
  }

  return data
    .filter((row) => row.archived_at === null)
    .map((row) => ({ id: row.id, name: row.name }));
}
