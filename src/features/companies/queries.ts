import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import type { CompanyFilter, CompanyItem } from "@/features/companies/schema";
import type { CompanyRow } from "@/lib/database.types";

/** 会社の DTO を組み立てる。名前と件数の引き当ては呼び出し側が用意する。 */
function toItem(
  row: CompanyRow,
  statusNames: Map<string, string>,
  cardCounts: Map<string, number>
): CompanyItem {
  return {
    id: row.id,
    name: row.name,
    nameKana: row.name_kana,
    statusId: row.status_id,
    statusName: row.status_id ? (statusNames.get(row.status_id) ?? null) : null,
    website: row.website,
    address: row.address,
    phone: row.phone,
    note: row.note,
    cardCount: cardCounts.get(row.id) ?? 0,
    createdBy: displayName(row.created_by),
    createdAt: row.created_at,
  };
}

/**
 * 取引先一覧。名前順。
 *
 * 名刺の枚数は business_cards から company_id だけを引いて数える。
 * 欲しいのが会社ごとに 1 つの数値だけなので、集計関数を足すより単純。
 */
export async function getCompanies(filter: CompanyFilter = {}): Promise<CompanyItem[]> {
  await requireSession();

  let query = supabase.from("companies").select("*").order("name");

  if (filter.statusId) query = query.eq("status_id", filter.statusId);

  if (filter.keyword) {
    // PostgREST の or() では値中の "," と "." が区切りと紛らわしいので落とす
    const keyword = filter.keyword.replace(/[,.()]/g, " ").trim();

    if (keyword !== "") {
      const pattern = `%${keyword}%`;
      query = query.or(
        [`name.ilike.${pattern}`, `name_kana.ilike.${pattern}`, `note.ilike.${pattern}`].join(",")
      );
    }
  }

  const [companiesResult, statusesResult, cardsResult] = await Promise.all([
    query,
    supabase.from("company_statuses").select("id, name"),
    supabase.from("business_cards").select("company_id").not("company_id", "is", null),
  ]);

  if (companiesResult.error) {
    throw new Error(`取引先の取得に失敗しました: ${companiesResult.error.message}`);
  }
  if (statusesResult.error) {
    throw new Error(`ステータスの取得に失敗しました: ${statusesResult.error.message}`);
  }
  if (cardsResult.error) {
    throw new Error(`名刺の集計に失敗しました: ${cardsResult.error.message}`);
  }

  // 閉じたステータスも含めて引く。過去に付けた名前は出したいため。
  const statusNames = new Map(statusesResult.data.map((row) => [row.id, row.name]));
  const cardCounts = new Map<string, number>();

  for (const row of cardsResult.data) {
    const id = row.company_id as string;
    cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
  }

  return companiesResult.data.map((row) => toItem(row, statusNames, cardCounts));
}

export async function getCompany(companyId: string): Promise<CompanyItem | null> {
  await requireSession();

  const [companyResult, statusesResult, cardsResult] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
    supabase.from("company_statuses").select("id, name"),
    supabase.from("business_cards").select("company_id").eq("company_id", companyId),
  ]);

  if (companyResult.error) {
    throw new Error(`取引先の取得に失敗しました: ${companyResult.error.message}`);
  }
  if (!companyResult.data) return null;

  const statusNames = new Map((statusesResult.data ?? []).map((row) => [row.id, row.name]));
  const cardCounts = new Map([[companyId, cardsResult.data?.length ?? 0]]);

  return toItem(companyResult.data, statusNames, cardCounts);
}

/** 名刺のフォームで会社を選ぶための最小情報。 */
export async function getCompanyOptions(): Promise<{ id: string; name: string }[]> {
  await requireSession();

  const { data, error } = await supabase.from("companies").select("id, name").order("name");

  if (error) {
    throw new Error(`取引先の取得に失敗しました: ${error.message}`);
  }

  return data;
}
