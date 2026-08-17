import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/form";

/**
 * 名刺の入手経路。画面での見せ方と、画像を持つかどうかの判断に使う。
 * 値は 0010 のマイグレーションの CHECK 制約と揃えること。
 */
export const CARD_SOURCES = ["paper", "digital", "vcard", "manual"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

export const CARD_SOURCE_LABELS: Record<CardSource, string> = {
  paper: "紙の名刺",
  digital: "電子名刺",
  vcard: "vCard",
  manual: "手入力",
};

export function toCardSource(value: string | null | undefined): CardSource {
  return CARD_SOURCES.includes(value as CardSource) ? (value as CardSource) : "manual";
}

/** 空文字を null に倒したうえでメールとして検証する任意項目。 */
const optionalEmailText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "メールアドレスの形式が正しくありません"
  );

/** http(s) の URL だけ通す任意項目。 */
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || /^https?:\/\//.test(value),
    "http:// または https:// から始まる URL を入力してください"
  );

export const businessCardFormSchema = z.object({
  id: z.uuid().optional(),
  companyId: optionalUuid,
  fullName: z.string().trim().min(1, "氏名は必須です").max(100),
  fullNameKana: optionalText(100),
  department: optionalText(100),
  title: optionalText(100),
  email: optionalEmailText,
  phone: optionalText(40),
  mobile: optionalText(40),
  digitalCardUrl: optionalUrl,
  source: z.enum(CARD_SOURCES).catch("manual"),
  receivedAt: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "日付の形式が不正です"
    ),
  note: optionalText(2000),
  /**
   * 読み取り時に保存した画像の Storage 上のパス。
   * 空なら画像は変えない（編集時に既存のものを残す）。
   */
  imagePath: optionalText(200),
});

export type BusinessCardFormInput = z.input<typeof businessCardFormSchema>;

/** 一覧・詳細に渡す DTO。 */
export type BusinessCardItem = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  fullName: string;
  fullNameKana: string | null;
  department: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  digitalCardUrl: string | null;
  source: CardSource;
  /** 署名付きの画像 URL。未取得なら null。 */
  imageUrl: string | null;
  receivedAt: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

/** OCR が返す項目。どれも取れないことがある。 */
export type ScannedCard = {
  companyName: string | null;
  fullName: string | null;
  fullNameKana: string | null;
  department: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  address: string | null;
};
