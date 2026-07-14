import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { CredentialItem, SectionGroup } from "@/features/credentials/schema";

export const UNSECTIONED_LABEL = "未分類（単一登録）";

/**
 * セクションと、それに紐づくクレデンシャルをまとめて取得する。
 * 暗号文は返さない（存在有無だけを boolean で返す）。平文が必要なときは
 * revealSecret アクションを都度呼ぶ。
 */
export async function getSectionsWithCredentials(): Promise<SectionGroup[]> {
  await requireSession();

  const [sectionsResult, credentialsResult] = await Promise.all([
    supabase.from("sections").select("*").order("sort_order").order("created_at"),
    supabase.from("credentials").select("*").order("name"),
  ]);

  if (sectionsResult.error) {
    throw new Error(`セクションの取得に失敗しました: ${sectionsResult.error.message}`);
  }
  if (credentialsResult.error) {
    throw new Error(`クレデンシャルの取得に失敗しました: ${credentialsResult.error.message}`);
  }

  const toItem = (row: (typeof credentialsResult.data)[number]): CredentialItem => ({
    id: row.id,
    sectionId: row.section_id,
    name: row.name,
    username: row.username,
    url: row.url,
    hasPassword: Boolean(row.password_ciphertext),
    hasNotes: Boolean(row.notes_ciphertext),
    // DB にはメールアドレスを保存し、表示名は env から引く
    createdBy: displayName(row.created_by),
    updatedAt: row.updated_at,
  });

  const groups: SectionGroup[] = sectionsResult.data.map((section) => ({
    id: section.id,
    name: section.name,
    description: section.description,
    credentials: credentialsResult.data
      .filter((row) => row.section_id === section.id)
      .map(toItem),
  }));

  // セクションに属さないもの（単一登録）は最後の枠にまとめる
  const unsectioned = credentialsResult.data.filter((row) => row.section_id === null).map(toItem);

  groups.push({
    id: null,
    name: UNSECTIONED_LABEL,
    description: null,
    credentials: unsectioned,
  });

  return groups;
}
