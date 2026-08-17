import type { NextRequest } from "next/server";
import { ok, fail, readJson, withSession } from "@/lib/api";
import { textField } from "@/lib/form";
import { isPerplexityConfigured } from "@/lib/perplexity";
import { EMPTY_SCAN, scanBusinessCard } from "@/features/business-cards/ocr";
import { findCompanyCandidates } from "@/features/business-cards/queries";
import { stageCardImage } from "@/features/business-cards/storage";

/**
 * 読み取りに使える時間。
 *
 * Hobby でも既定は 300 秒なので通常は足りるが、この処理だけは外部の応答を
 * 待つので明示しておく（lib/perplexity.ts 側の待ち時間より必ず長くすること。
 * 逆にすると、こちらのメッセージではなく素っ気ない実行時間超過になる）。
 */
export const maxDuration = 120;

/**
 * 名刺画像を保存し、続けて読み取る。名刺そのものの登録はまだしない。
 *
 * 画像は先に Supabase へ置き、読み取りには署名付き URL だけを渡す。
 * 実測で、Vercel の関数から 180KB の本文を Perplexity へ送ると 100 秒経っても
 * 返らなかったのに対し、URL（0.6KB）にすると 9 秒で返った。
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

    const staged = await stageCardImage(imageDataUrl);

    if (!staged) {
      return fail("画像を保存できませんでした。もう一度撮り直してください。");
    }

    // 読み取りが使えない環境でも、画像だけは残して手入力で進められるようにする
    if (!isPerplexityConfigured()) {
      return ok("画像を保存しました。項目は手で入力してください。", {
        card: EMPTY_SCAN,
        candidates: [],
        imagePath: staged.path,
      });
    }

    const result = await scanBusinessCard(staged.url);

    if (result.status === "error") {
      // 読めなくても画像は保存済み。パスを返して手入力へ進ませる。
      return ok(result.message, {
        card: EMPTY_SCAN,
        candidates: [],
        imagePath: staged.path,
        failed: true,
      });
    }

    const candidates = result.card.companyName
      ? await findCompanyCandidates(result.card.companyName)
      : [];

    return ok("読み取りました。内容を確認してください。", {
      card: result.card,
      candidates,
      imagePath: staged.path,
    });
  });
}
