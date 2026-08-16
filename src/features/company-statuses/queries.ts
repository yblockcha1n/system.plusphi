import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { CompanyStatusItem, CompanyStatusOption } from "@/features/company-statuses/schema";

export const UNTYPED_LABEL = "ステータスなし";

/**
 * マスタ管理画面用。閉じたものも含めて全件を、利用件数つきで返す。
 *
 * 件数は取引先側から status_id だけを引いて数える。ステータスは数個で、
 * 数えたいのが「1 ステータスあたり 1 つの数値」だけなので、集計関数を足すより
 * この方が単純（プロジェクトの集計と違い、取引先全件を運ぶわけではない）。
 */
export async function getCompanyStatuses(): Promise<CompanyStatusItem[]> {
  await requireSession();

  const [statusesResult, countsResult] = await Promise.all([
    supabase.from("company_statuses").select("*").order("sort_order").order("created_at"),
    supabase.from("companies").select("status_id").not("status_id", "is", null),
  ]);

  if (statusesResult.error) {
    throw new Error(`取引先ステータスの取得に失敗しました: ${statusesResult.error.message}`);
  }
  if (countsResult.error) {
    throw new Error(`取引先の集計に失敗しました: ${countsResult.error.message}`);
  }

  const counts = new Map<string, number>();

  for (const row of countsResult.data) {
    const id = row.status_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return statusesResult.data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdBy: displayName(row.created_by),
    companyCount: counts.get(row.id) ?? 0,
  }));
}

/**
 * 取引先のフォームに出す選択肢。閉じたステータスは出さない。
 *
 * ただし編集中の取引先に既に付いているステータスが閉じられていた場合、選択肢に無いと
 * 保存のたびに外れてしまう。呼び出し側で現在値を足せるよう、この関数は
 * 「今選べるもの」だけを返し、判断は画面側に委ねる。
 */
export async function getCompanyStatusOptions(): Promise<CompanyStatusOption[]> {
  await requireSession();

  const { data, error } = await supabase
    .from("company_statuses")
    .select("id, name, archived_at")
    .order("sort_order")
    .order("created_at");

  if (error) {
    throw new Error(`取引先ステータスの取得に失敗しました: ${error.message}`);
  }

  return data
    .filter((row) => row.archived_at === null)
    .map((row) => ({ id: row.id, name: row.name }));
}
