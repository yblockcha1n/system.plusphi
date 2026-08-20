import "server-only";
import { env } from "@/lib/env";
import { fetchExternal, type ExternalResponse } from "@/lib/http";

/**
 * Perplexity Agent API を叩く薄い口。
 *
 * 判断が要る箇所（応答の取り出し方、失敗の見分け方）をここ 1 か所に閉じる。
 * 同じ判断を scripts/release-notes.mjs も持っているが、あちらは CI で
 * npm install なしに動かす都合で独立している（依存を持たせたくない）。
 *
 * 覚えておくこと:
 *  - エンドポイントは /v1/agent。旧 /v1/sonar（chat completions）はレガシー
 *  - web 検索は tools を渡したときだけ走る。渡さなければ検索しない
 *  - HTTP 200 でも中で失敗していることがあるので status を必ず見る
 *  - モデル slug は "perplexity/sonar" のように接頭辞が要る。
 *    画像を読ませるには視覚対応のモデルを使う（既定は env.ts 参照）
 */

const ENDPOINT = "https://api.perplexity.ai/v1/agent";

/**
 * 応答を待つ上限と、諦めたあとのやり直し回数。
 *
 * 既定のモデルなら名刺 1 枚が 4 秒前後で返る。長く待つほど利用者を待たせるだけ
 * なので短めに切り、たまたま詰まった場合は待つのではなく投げ直す。
 * 実測では、同じ画像でも 1 回目だけ返らず 2 回目は普通に返ることがあった。
 *
 * 合計の待ち時間（35 秒 × 2）は、呼び出し側の関数の上限より内側に収めること。
 */
const TIMEOUT_MS = 35_000;
const MAX_ATTEMPTS = 2;

export function isPerplexityConfigured(): boolean {
  return Boolean(env.PERPLEXITY_API_KEY);
}

type ImagePart = { type: "input_image"; image_url: string };
type TextPart = { type: "input_text"; text: string };

export type AgentRequest = {
  /** 省略時は視覚対応の既定モデル。 */
  model?: string;
  instructions: string;
  text: string;
  /** データ URI か https の画像 URL。 */
  imageUrls?: string[];
  maxOutputTokens?: number;
};

/**
 * 問い合わせて本文の文字列を返す。
 *
 * 失敗は例外で伝える。呼び出し側（OCR）はそれを握って「読めなかった」として
 * 扱うが、原因を追えるよう応答本文をそのままメッセージに含める。
 */
export async function askAgent({
  model,
  instructions,
  text,
  imageUrls = [],
  maxOutputTokens = 1200,
}: AgentRequest): Promise<string> {
  if (!env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY が設定されていません。");
  }

  const content: (TextPart | ImagePart)[] = [{ type: "input_text", text }];

  for (const imageUrl of imageUrls) {
    content.push({ type: "input_image", image_url: imageUrl });
  }

  const requestBody = JSON.stringify({
    model: model ?? env.PERPLEXITY_VISION_MODEL,
    instructions,
    // 画像を混ぜるときは input を配列で渡す形になる
    input: [{ role: "user", content }],
    max_output_tokens: maxOutputTokens,
  });

  // 遅いときに「どれだけ送って何秒待ったか」が分からないと切り分けられない
  const sizeKb = Math.round(requestBody.length / 1024);
  const started = Date.now();
  const elapsed = () => ((Date.now() - started) / 1000).toFixed(1);

  let response: ExternalResponse | null = null;
  let lastReason = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // fetchExternal: Vercel から IPv6 で出ようとして無応答になるのを避ける（lib/http.ts）
      response = await fetchExternal(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: requestBody,
      });
      break;
    } catch (cause) {
      lastReason = cause instanceof Error ? cause.message : String(cause);

      // 詰まったまま待つより投げ直したほうが早く返る（同じ画像でも起きる）
      console.warn("[perplexity] 応答が無いのでやり直します", {
        attempt,
        sizeKb,
        seconds: elapsed(),
        reason: lastReason,
      });
    }
  }

  if (!response) {
    throw new Error(
      `Perplexity への要求が終わりませんでした（送信 ${sizeKb}KB / ${MAX_ATTEMPTS} 回試して ${elapsed()} 秒: ${lastReason}）。`
    );
  }

  const body = await response.text();

  console.info("[perplexity] 応答", {
    model: model ?? env.PERPLEXITY_VISION_MODEL,
    sizeKb,
    seconds: elapsed(),
    status: response.status,
  });

  if (!response.ok) {
    throw new Error(`Perplexity への要求が失敗しました (HTTP ${response.status}): ${trim(body)}`);
  }

  const payload = JSON.parse(body) as {
    status?: string;
    output_text?: unknown;
    output?: { content?: { text?: unknown }[] }[];
  };

  if (payload.status && payload.status !== "completed") {
    throw new Error(`Perplexity の応答が未完了です (status=${payload.status}): ${trim(body)}`);
  }

  return readOutputText(payload, body);
}

/** 応答本文を取り出す。output_text が無ければ output[] を辿る。 */
function readOutputText(
  payload: { output_text?: unknown; output?: { content?: { text?: unknown }[] }[] },
  raw: string
): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim() !== "") {
    return payload.output_text;
  }

  const chunks: string[] = [];

  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }

  if (chunks.length === 0) {
    throw new Error(`Perplexity の応答から本文を取り出せませんでした: ${trim(raw)}`);
  }

  return chunks.join("\n");
}

/**
 * 応答から JSON を取り出す。前後に説明を付けてくることがあるので、
 * 最初の { から最後の } までを拾う。読めなければ null。
 */
export function extractJson<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");

  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** エラーメッセージにそのまま載せると長すぎるので頭だけにする。 */
function trim(value: string): string {
  return value.length > 400 ? `${value.slice(0, 400)}…` : value;
}
