import "server-only";
import { fetchExternal, type ExternalResponse } from "@/lib/http";
import { parseInspirationUrl, type ParsedUrl } from "@/features/inspirations/url";

/**
 * 貼られた URL から、タイトル・投稿者・サムネイル URL を取れるだけ取る。
 *
 * ここは外部サービス頼みなので必ず失敗しうる。**取れなくても登録は通す**のが方針で、
 * この層は例外を投げず、分かったぶんだけ返す。URL とメモとタグさえあれば
 * ナレッジベースとしては成立する。
 *
 * プラットフォームごとの取得元:
 *  - Instagram : /embed/ の HTML を読む（公式 oEmbed はサムネも投稿者も返さないため）
 *  - TikTok    : 公式 oEmbed（無認証）
 *  - YouTube   : 公式 oEmbed（無認証）
 *  - X         : 公式 oEmbed（無認証・サムネは無い）
 */

export type FetchedMetadata = {
  title: string | null;
  authorName: string | null;
  /** 取得元のサムネ URL。保存は thumbnail.ts が行う。 */
  thumbnailUrl: string | null;
  /** 短縮 URL を展開できた場合に差し替えるための解析結果。 */
  resolved: ParsedUrl | null;
};

const EMPTY: FetchedMetadata = {
  title: null,
  authorName: null,
  thumbnailUrl: null,
  resolved: null,
};

/** 外部が返してこないときに待ち続けないための上限。 */
const TIMEOUT_MS = 8000;

/**
 * 名乗る UA。
 *
 * ここは実測で決めている。Chrome の完全な UA を送ると、Instagram の /embed/ は
 * 「JS で描画する版」（634KB・サーバー側に画像タグが無い）を返してしまい、
 * サムネも投稿者名も抜き出せない。短い UA だとサーバー描画版（224KB・画像あり）が
 * 返る。ブラウザのふりをしない方が都合がよい、という珍しいケース。
 *
 * この形で YouTube / TikTok / X の oEmbed も問題なく応答することを確認済み。
 */
const USER_AGENT = "Mozilla/5.0 (compatible; plusphi-knowledge/1.0)";

async function get(url: string): Promise<ExternalResponse | null> {
  try {
    const response = await fetchExternal(url, {
      // Accept-Language は送らない。付けると Instagram が言語ごとに違う文面の
      // HTML を返し、抽出が言語に左右されてしまう（既定の英語版に固定する）。
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return response.ok ? response : null;
  } catch {
    // タイムアウト・名前解決の失敗など。呼び出し側は「取れなかった」として扱う。
    return null;
  }
}

export async function fetchMetadata(parsed: ParsedUrl): Promise<FetchedMetadata> {
  try {
    switch (parsed.platform) {
      case "instagram":
        return await fromInstagram(parsed);
      case "tiktok":
        return await fromTikTok(parsed);
      case "youtube":
        return await fromYouTube(parsed);
      case "x":
        return await fromX(parsed);
      default:
        return EMPTY;
    }
  } catch (cause) {
    console.error("[inspirations] メタ情報の取得に失敗しました", {
      url: parsed.canonicalUrl,
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return EMPTY;
  }
}

/* ------------------------------ Instagram ------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/**
 * HTML 実体参照を戻す。画像 URL は属性値のまま使うので `&amp;` を戻さないと壊れ、
 * X の本文には `&mdash;` などがそのまま出てくる。
 *
 * replace は元の文字列を左から一度だけ走査するので、置換後の文字が再度
 * 置換対象になることはない（`&amp;lt;` は `&lt;` までしか戻らない）。
 */
function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Instagram は投稿ページ本体がログイン壁で読めないが、埋め込み用の /embed/ は
 * 認証なしで返る。その HTML にサムネ URL と投稿者名が入っているので抜き出す。
 *
 * 正規表現でのスクレイピングなので、Meta が DOM を変えれば取れなくなる。
 * 取れなくても null を返すだけで、登録も再生も動き続ける。
 */
async function fromInstagram(parsed: ParsedUrl): Promise<FetchedMetadata> {
  let target = parsed;

  // アプリの「リンクをコピー」が返す /share/... は投稿 ID を含まないので、
  // 実際に辿って本来の URL に直してから扱う。
  if (!target.externalId) {
    const expanded = await expandInstagramShare(target.canonicalUrl);
    if (!expanded) return EMPTY;
    target = expanded;
  }

  const path = target.contentKind === "reel" ? "reel" : "p";
  const response = await get(`https://www.instagram.com/${path}/${target.externalId}/embed/`);

  if (!response) return { ...EMPTY, resolved: target === parsed ? null : target };

  const html = await response.text();

  const image = /<img[^>]+class="EmbeddedMediaImage"[^>]+src="([^"]+)"/.exec(html);

  // alt は "Instagram post shared by &#064;kevin" の形。
  // 末尾を `"` で閉じないのが要点で、言語によっては名前の後ろに文が続く
  // （日本語だと "&#064;kevin&#x304c;シェアした投稿"）。@ の直後の
  // ユーザー名として使える文字だけを取る。
  const author = /alt="[^"]*?(?:&#0?64;|@)([A-Za-z0-9._]{1,30})/.exec(html);

  return {
    title: null, // キャプションは /embed/ にも /embed/captioned/ にも入っていない
    authorName: author ? author[1] : target.authorName,
    thumbnailUrl: image ? decodeEntities(image[1]) : null,
    resolved: target === parsed ? null : target,
  };
}

/**
 * /share/... を本来の投稿 URL に直す。
 *
 * リダイレクトで飛ぶこともあるが、飛ばずに HTML を返してくることもあるため、
 * 最終 URL → HTML 内の canonical/og:url → 本文中の /reel/ か /p/ の順に探す。
 */
async function expandInstagramShare(shareUrl: string): Promise<ParsedUrl | null> {
  const response = await get(shareUrl);
  if (!response) return null;

  const fromRedirect = parseInspirationUrl(response.url);
  if (fromRedirect?.externalId) return fromRedirect;

  const html = await response.text();

  const canonical =
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(html)?.[1] ??
    /<meta[^>]+property="og:url"[^>]+content="([^"]+)"/.exec(html)?.[1] ??
    // 最後の頼み。本文に出てくる最初の投稿パスを拾う。
    /https:\/\/www\.instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+/.exec(html)?.[0];

  if (!canonical) return null;

  const parsed = parseInspirationUrl(decodeEntities(canonical));
  return parsed?.externalId ? parsed : null;
}

/* -------------------------------- oEmbed -------------------------------- */

type OEmbed = {
  title?: unknown;
  author_name?: unknown;
  thumbnail_url?: unknown;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

async function oembed(endpoint: string): Promise<OEmbed | null> {
  const response = await get(endpoint);
  if (!response) return null;

  try {
    return (await response.json()) as OEmbed;
  } catch {
    return null;
  }
}

async function fromTikTok(parsed: ParsedUrl): Promise<FetchedMetadata> {
  // vm.tiktok.com の短縮 URL は ID を含まないので、まず本来の URL へ展開する。
  let target = parsed;

  if (!parsed.externalId) {
    const expanded = await expandShortUrl(parsed.canonicalUrl);
    if (!expanded) return EMPTY;
    target = expanded;
  }

  const data = await oembed(
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(target.canonicalUrl)}`
  );

  if (!data) return { ...EMPTY, resolved: target === parsed ? null : target };

  return {
    title: text(data.title),
    authorName: text(data.author_name) ?? target.authorName,
    thumbnailUrl: text(data.thumbnail_url),
    resolved: target === parsed ? null : target,
  };
}

async function fromYouTube(parsed: ParsedUrl): Promise<FetchedMetadata> {
  if (!parsed.externalId) return EMPTY;

  const data = await oembed(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}`
  );

  return {
    title: text(data?.title),
    authorName: text(data?.author_name),
    // oEmbed のサムネは 480x360。取れなくても既定のパスから拾えるので保険を置く。
    thumbnailUrl:
      text(data?.thumbnail_url) ??
      `https://i.ytimg.com/vi/${parsed.externalId}/hqdefault.jpg`,
    resolved: null,
  };
}

async function fromX(parsed: ParsedUrl): Promise<FetchedMetadata> {
  if (!parsed.externalId) return EMPTY;

  const data = await oembed(
    `https://publish.x.com/oembed?omit_script=true&url=${encodeURIComponent(parsed.canonicalUrl)}`
  );

  // X の oEmbed は本文を html に埋めて返すだけでサムネは無い。
  // タイトル代わりに本文の頭を切り出して一覧の手掛かりにする。
  const html = typeof (data as { html?: unknown })?.html === "string"
    ? ((data as { html: string }).html)
    : "";

  const body = decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: body === "" ? null : body.slice(0, 120),
    authorName: text(data?.author_name) ?? parsed.authorName,
    thumbnailUrl: null,
    resolved: null,
  };
}

/* ------------------------------ 短縮 URL ------------------------------ */

/**
 * vm.tiktok.com のような短縮 URL を辿って本来の URL に戻す。
 * 辿れなければ null（呼び出し側は元の URL のまま扱う）。
 */
async function expandShortUrl(url: string): Promise<ParsedUrl | null> {
  const response = await get(url);
  if (!response) return null;

  const expanded = parseInspirationUrl(response.url);

  // 展開しても ID が取れないなら意味が無い
  return expanded?.externalId ? expanded : null;
}
