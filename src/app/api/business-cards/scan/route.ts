import type { NextRequest } from "next/server";
import { ok, fail, readJson, withSession } from "@/lib/api";
import { scanBusinessCard } from "@/features/business-cards/ocr";
import { findCompanyCandidates } from "@/features/business-cards/queries";
import { textField } from "@/lib/form";

/**
 * 名刺画像を読み取るだけ。保存はしない。
 *
 * 結果はフォームの下書きとして返し、人が確認してから登録する。あわせて、
 * 読めた会社名から既存の取引先の候補も返す（同じ会社を作り直さないため）。
 */
export async function POST(request: NextRequest) {
  return withSession(request, async () => {
    const input = await readJson(request);
    const imageDataUrl = textField(input, "imageDataUrl");

    if (imageDataUrl === "") {
      return fail("画像が送られていません。");
    }

    const result = await scanBusinessCard(imageDataUrl);

    if (result.status === "error") {
      return fail(result.message);
    }

    const candidates = result.card.companyName
      ? await findCompanyCandidates(result.card.companyName)
      : [];

    return ok("読み取りました。内容を確認してください。", {
      card: result.card,
      candidates,
    });
  });
}
