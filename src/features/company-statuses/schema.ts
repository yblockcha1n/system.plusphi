import { z } from "zod";
import { optionalText } from "@/lib/form";

/**
 * 取引先ステータスのマスタ。
 *
 * enum やアプリ側の定数にしていないのは、運用しながら画面から増減・改名したいため。
 * ステータスを消しても取引先は残る（companies.status_id は on delete set null）。
 */
export const companyStatusFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "ステータス名は必須です").max(60),
  description: optionalText(200),
});

export type CompanyStatusFormInput = z.input<typeof companyStatusFormSchema>;

/** 一覧・管理画面に渡す DTO。 */
export type CompanyStatusItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** null = 利用中。 */
  archivedAt: string | null;
  createdBy: string | null;
  /** このステータスが付いている取引先の件数。削除の影響を画面に出すために持つ。 */
  companyCount: number;
};

/** Select 用の最小情報。 */
export type CompanyStatusOption = {
  id: string;
  name: string;
};
