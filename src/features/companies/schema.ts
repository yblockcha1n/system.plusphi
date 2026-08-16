import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/form";

/**
 * 取引先。
 *
 * まだ toB の取引先ではない相手も入るので、必須は名前だけにしてある。
 * 「どこまで話が進んでいるか」はステータスで表す（company_statuses）。
 */
export const companyFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "会社名は必須です").max(200),
  nameKana: optionalText(200),
  statusId: optionalUuid,
  website: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || /^https?:\/\//.test(value),
      "http:// または https:// から始まる URL を入力してください"
    ),
  address: optionalText(300),
  phone: optionalText(40),
  note: optionalText(2000),
});

export type CompanyFormInput = z.input<typeof companyFormSchema>;

/** 一覧・詳細に渡す DTO。 */
export type CompanyItem = {
  id: string;
  name: string;
  nameKana: string | null;
  statusId: string | null;
  statusName: string | null;
  website: string | null;
  address: string | null;
  phone: string | null;
  note: string | null;
  /** ぶら下がっている名刺の枚数。 */
  cardCount: number;
  createdBy: string | null;
  createdAt: string;
};

/** 一覧の絞り込み。ナレッジと同じく URL から組み立てる。 */
export type CompanyFilter = {
  statusId?: string;
  /** 会社名・ふりがな・メモへのあいまい検索。 */
  keyword?: string;
};
