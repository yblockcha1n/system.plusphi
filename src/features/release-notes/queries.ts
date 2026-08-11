import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { ReleaseNoteItem } from "@/features/release-notes/schema";
import type { ReleaseNoteRow } from "@/lib/database.types";

function toItem(row: ReleaseNoteRow): ReleaseNoteItem {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    baseSha: row.base_sha,
    headSha: row.head_sha,
    commitCount: row.commit_count,
    generatedBy: row.generated_by,
    publisher: displayName(row.publisher),
    createdAt: row.created_at,
  };
}

/**
 * 一覧。下書きも含めて新しい順に返す。
 *
 * 社内の全員が同じものを見る前提なので、下書きも隠さない（誰が公開してもよい）。
 */
export async function getReleaseNotes(): Promise<ReleaseNoteItem[]> {
  await requireSession();

  const { data, error } = await supabase
    .from("release_notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`パッチノートの取得に失敗しました: ${error.message}`);
  }

  return data.map(toItem);
}
