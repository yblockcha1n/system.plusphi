import "server-only";
import { askAgent, extractJson, isPerplexityConfigured } from "@/lib/perplexity";
import type { ScannedCard } from "@/features/business-cards/schema";

/**
 * 名刺の画像から項目を読み取る。
 *
 * 読み取り結果は「フォームの下書き」でしかない。人名の異体字（髙・﨑）、縦書き、
 * ロゴと社名の混同などで必ず間違えるので、保存前に人が目を通す前提で使う。
 * この層は取れたぶんだけ返し、判断は画面に委ねる。
 */

const EMPTY: ScannedCard = {
  companyName: null,
  fullName: null,
  fullNameKana: null,
  department: null,
  title: null,
  email: null,
  phone: null,
  mobile: null,
  website: null,
  address: null,
};

const INSTRUCTIONS = `あなたは日本語の名刺を読み取る担当です。
渡された画像から記載事項を読み取り、JSONだけを返してください。

守ること:
- 画像に書かれていない項目は null にする。推測で埋めない。
- 会社名は法人格（株式会社・有限会社・合同会社など）を省略せず、書かれたまま。
- 氏名は姓と名の間に半角スペースを1つ入れる。
- ふりがな・ローマ字表記があれば fullNameKana に入れる。無ければ null。
- 電話番号は書かれている区切り（ハイフン）をそのまま残す。
- 固定電話は phone、携帯（090/080/070 で始まるもの、または「携帯」「Mobile」と
  書かれているもの）は mobile に分ける。FAX は入れない。
- 部署と役職は分ける。「営業部 部長」なら department に「営業部」、title に「部長」。
- 住所は郵便番号を含めて1行にまとめる。
- 読み取れない項目を無理に埋めるより、null のままにするほうが良い。

出力は次の形式のJSONのみ。前後に説明を付けないこと。
{"companyName":null,"fullName":null,"fullNameKana":null,"department":null,"title":null,"email":null,"phone":null,"mobile":null,"website":null,"address":null}`;

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // モデルが "null" や "不明" と文字列で返してくることがある
  if (trimmed === "" || /^(null|none|不明|なし|-)$/i.test(trimmed)) return null;
  return trimmed.slice(0, 200);
};

export type ScanResult =
  | { status: "success"; card: ScannedCard }
  | { status: "error"; message: string };

/**
 * @param imageDataUrl ブラウザで縮小済みのデータ URI。
 *   縮小は必須（Vercel のボディ上限 4.5MB は変更できないため）。
 */
export async function scanBusinessCard(imageDataUrl: string): Promise<ScanResult> {
  if (!isPerplexityConfigured()) {
    return {
      status: "error",
      message: "OCR が設定されていません。管理者に PERPLEXITY_API_KEY の設定を依頼してください。",
    };
  }

  try {
    const raw = await askAgent({
      instructions: INSTRUCTIONS,
      text: "この名刺を読み取ってください。",
      imageUrls: [imageDataUrl],
      maxOutputTokens: 800,
    });

    const parsed = extractJson<Record<string, unknown>>(raw);

    if (!parsed) {
      return {
        status: "error",
        message: "読み取り結果を解釈できませんでした。手入力で登録してください。",
      };
    }

    const card: ScannedCard = {
      companyName: text(parsed.companyName),
      fullName: text(parsed.fullName),
      fullNameKana: text(parsed.fullNameKana),
      department: text(parsed.department),
      title: text(parsed.title),
      email: text(parsed.email),
      phone: text(parsed.phone),
      mobile: text(parsed.mobile),
      website: text(parsed.website),
      address: text(parsed.address),
    };

    // 何一つ読めなかったのは、名刺以外の画像か、画質が足りない場合
    if (Object.values(card).every((value) => value === null)) {
      return {
        status: "error",
        message: "名刺として読み取れませんでした。明るい場所で撮り直すか、手入力してください。",
      };
    }

    return { status: "success", card };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);

    console.error("[business-cards] OCR に失敗しました", { message });

    // 原因を追えるよう、API の応答をそのまま画面まで返す（社内用のため）
    return { status: "error", message: `読み取りに失敗しました: ${message}` };
  }
}

export { EMPTY as EMPTY_SCAN };
