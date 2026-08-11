import { z } from "zod";
import { optionalText } from "@/lib/form";
import {
  parseInspirationUrl,
  type ContentKind,
  type Platform,
} from "@/features/inspirations/url";

/**
 * 参考にした投稿の登録フォーム。
 *
 * 必須は URL だけ。タイトルや投稿者は自動取得を試みるが、取れなくても登録は通す。
 * 「保存できない URL を作らない」のがこの機能の方針（url.ts のコメント参照）。
 */
export const inspirationFormSchema = z.object({
  id: z.uuid().optional(),
  url: z
    .string()
    .trim()
    .min(1, "URL は必須です")
    .max(2000)
    // スキーム無しでも貼れるようにしたいので z.url() は使わず、解析できるかで見る
    .refine((value) => {
      const parsed = parseInspirationUrl(value);
      // ホスト名にドットが無いものは URL の打ち間違いとみなす
      return parsed !== null && new URL(parsed.canonicalUrl).hostname.includes(".");
    }, "URL の形式が正しくありません"),
  title: optionalText(300),
  note: optionalText(2000),
  authorName: optionalText(100),
  // タグはチェックボックス群だが、FormData を Object.fromEntries する都合で
  // 同名の複数値は最後の 1 つしか残らない。画面側で hidden input に
  // カンマ区切りで詰めて送る（UserChecklist と同じやり方）。
  tagIds: z
    .string()
    .trim()
    .transform((value) =>
      value === ""
        ? []
        : [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
    )
    .pipe(z.array(z.uuid("タグの指定が不正です")).max(30)),
});

export type InspirationFormInput = z.input<typeof inspirationFormSchema>;

/** 一覧・詳細に渡す DTO。 */
export type InspirationItem = {
  id: string;
  url: string;
  platform: Platform;
  contentKind: ContentKind;
  externalId: string | null;
  title: string | null;
  authorName: string | null;
  note: string | null;
  /** 署名付きのサムネ URL。未取得・期限切れなら null。 */
  thumbnailUrl: string | null;
  /** iframe に入れる URL。埋め込めないものは null。 */
  embedUrl: string | null;
  tagIds: string[];
  tagNames: string[];
  createdBy: string | null;
  createdAt: string;
};

/** 一覧の絞り込み条件。カレンダーと同じく URL から組み立てる。 */
export type InspirationFilter = {
  /** タグ id。未指定なら絞り込まない。 */
  tagId?: string;
  platform?: Platform;
  /** タイトル・メモ・投稿者へのあいまい検索。 */
  keyword?: string;
};
