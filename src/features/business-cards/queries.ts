import "server-only";
import { requireSession } from "@/lib/dal";
import { displayName } from "@/lib/env";
import { supabase } from "@/lib/supabase";
import { signObjects } from "@/lib/storage";
import { CARD_BUCKET } from "@/features/business-cards/storage";
import { toCardSource, type BusinessCardItem } from "@/features/business-cards/schema";
import { looksLikeSameCompany } from "@/features/business-cards/company-match";
import type { BusinessCardRow } from "@/lib/database.types";

export type BusinessCardFilter = {
  /** 特定の会社の名刺だけを引く。null は「会社未設定」。 */
  companyId?: string | null;
  /** ステータスで絞り込む。 */
  statusId?: string;
  /** 氏名・ふりがな・メール・会社名へのあいまい検索。 */
  keyword?: string;
};

function toItem(
  row: BusinessCardRow,
  companyNames: Map<string, string>,
  statusNames: Map<string, string>,
  signed: Map<string, string>
): BusinessCardItem {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_id ? (companyNames.get(row.company_id) ?? null) : null,
    statusId: row.status_id,
    statusName: row.status_id ? (statusNames.get(row.status_id) ?? null) : null,
    fullName: row.full_name,
    fullNameKana: row.full_name_kana,
    department: row.department,
    title: row.title,
    email: row.email,
    phone: row.phone,
    mobile: row.mobile,
    digitalCardUrl: row.digital_card_url,
    source: toCardSource(row.source),
    imageUrl: row.image_path ? (signed.get(row.image_path) ?? null) : null,
    receivedAt: row.received_at,
    note: row.note,
    createdBy: displayName(row.created_by),
    createdAt: row.created_at,
  };
}

/**
 * 名刺の一覧。新しく登録したものが上。
 *
 * 画像は非公開バケットに置いてあるので、表示のたびに署名付き URL を作る。
 */
export async function getBusinessCards(
  filter: BusinessCardFilter = {}
): Promise<BusinessCardItem[]> {
  await requireSession();

  let query = supabase
    .from("business_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (filter.companyId !== undefined) {
    query =
      filter.companyId === null
        ? query.is("company_id", null)
        : query.eq("company_id", filter.companyId);
  }

  if (filter.statusId) query = query.eq("status_id", filter.statusId);

  if (filter.keyword) {
    // PostgREST の or() では値中の "," と "." が区切りと紛らわしいので落とす
    const keyword = filter.keyword.replace(/[,.()]/g, " ").trim();

    if (keyword !== "") {
      const pattern = `%${keyword}%`;
      query = query.or(
        [
          `full_name.ilike.${pattern}`,
          `full_name_kana.ilike.${pattern}`,
          `email.ilike.${pattern}`,
          `department.ilike.${pattern}`,
        ].join(",")
      );
    }
  }

  const [cardsResult, companiesResult, statusesResult] = await Promise.all([
    query,
    supabase.from("companies").select("id, name"),
    supabase.from("company_statuses").select("id, name"),
  ]);

  if (cardsResult.error) {
    throw new Error(`名刺の取得に失敗しました: ${cardsResult.error.message}`);
  }
  if (companiesResult.error) {
    throw new Error(`取引先の取得に失敗しました: ${companiesResult.error.message}`);
  }
  if (statusesResult.error) {
    throw new Error(`ステータスの取得に失敗しました: ${statusesResult.error.message}`);
  }

  const companyNames = new Map(companiesResult.data.map((row) => [row.id, row.name]));
  // 閉じたステータスも含めて引く。過去に付けた名前は出したいため。
  const statusNames = new Map(statusesResult.data.map((row) => [row.id, row.name]));
  const signed = await signObjects(
    CARD_BUCKET,
    cardsResult.data.map((row) => row.image_path)
  );

  return cardsResult.data.map((row) => toItem(row, companyNames, statusNames, signed));
}

/**
 * 会社名から既存の取引先の候補を探す。
 *
 * OCR や vCard で読めた会社名をそのまま新規作成すると、表記ゆれで会社が乱立する。
 * 候補を出して人に選ばせるための照合で、法人格や記号の違いを吸収してから比べる。
 */
export async function findCompanyCandidates(
  companyName: string
): Promise<{ id: string; name: string }[]> {
  await requireSession();

  if (companyName.trim() === "") return [];

  const { data, error } = await supabase.from("companies").select("id, name");

  if (error) {
    throw new Error(`取引先の取得に失敗しました: ${error.message}`);
  }

  return data.filter((row) => looksLikeSameCompany(row.name, companyName)).slice(0, 5);
}

