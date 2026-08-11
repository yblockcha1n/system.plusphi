import { z } from "zod";
import { optionalText } from "@/lib/form";

/**
 * ナレッジベースのタグのマスタ。
 *
 * task_types と同じく enum ではなくテーブルにしている。「構図」「BGM」のような
 * 観点は運用しながら増えるもので、コードの変更なしに足せる必要があるため。
 */
export const inspirationTagFormSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "タグ名は必須です").max(40),
  description: optionalText(200),
});

export type InspirationTagFormInput = z.input<typeof inspirationTagFormSchema>;

/** マスタ管理画面に渡す DTO。 */
export type InspirationTagItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** null = 利用中。 */
  archivedAt: string | null;
  createdBy: string | null;
  /** このタグが付いている件数。削除の影響を画面に出すために持つ。 */
  usageCount: number;
};

/** 選択・絞り込みに使う最小情報。 */
export type InspirationTagOption = {
  id: string;
  name: string;
};
