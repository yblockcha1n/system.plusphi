import "server-only";
import { fetchExternal, fetchPublic, type ExternalResponse } from "@/lib/http";
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
 *  - その他     : ページの HTML から OGP を読む
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

async function get(
  url: string,
  headers: Record<string, string> = {}
): Promise<ExternalResponse | null> {
  try {
    const response = await fetchExternal(url, {
      // Accept-Language は送らない。付けると Instagram が言語ごとに違う文面の
      // HTML を返し、抽出が言語に左右されてしまう（既定の英語版に固定する）。
      headers: { "User-Agent": USER_AGENT, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    return response.ok ? response : null;
  } catch {
    // タイムアウト・名前解決の失敗など。呼び出し側は「取れなかった」として扱う。
    return null;
  }
}

export async function fetchMetadata(parsed: ParsedUrl): Promise<FetchedMetadata> {
  /*
   * アカウントは投稿とは別の口を使う。
   *
   * 投稿用の口にユーザー名を渡すと「それらしい別物」が返ってしまう（Instagram は
   * /p/{ユーザー名}/embed/ に 200 と無関係な投稿画像を返す）ため、ここで分ける。
   */
  if (parsed.contentKind === "account") {
    try {
      return await fromAccount(parsed);
    } catch (cause) {
      console.error("[inspirations] アカウント情報の取得に失敗しました", {
        url: parsed.canonicalUrl,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return { ...EMPTY, authorName: parsed.authorName };
    }
  }

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
        return await fromWebsite(parsed);
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

/* ------------------------------ アカウント ------------------------------ */

/**
 * プロフィールのメタ情報。
 *
 * サムネにはプロフィール画像を使う。アカウントを一枚の絵で表せるものは他に無く、
 * 直近の投稿を代表させると「投稿の登録」と見分けが付かなくなるため。
 *
 * title には表示名（例: 犬人間のゆめ。）、authorName にはユーザー名（例:
 * inuningennoyume）を入れる。一覧では title が見出し、authorName が @ 付きの
 * 添え字として出るので、この振り分けが自然に読める。
 *
 * YouTube と X は無認証で読める口が無い（YouTube のチャンネルは oEmbed が 404、
 * X のプロフィールは syndication が強く絞られている）ので何も取らない。
 */
async function fromAccount(parsed: ParsedUrl): Promise<FetchedMetadata> {
  const userName = parsed.externalId ?? parsed.authorName;

  if (!userName) return { ...EMPTY, authorName: parsed.authorName };

  switch (parsed.platform) {
    case "tiktok":
      return await tiktokAccount(userName, parsed.canonicalUrl);
    case "instagram":
      return await instagramAccount(userName);
    default:
      return { ...EMPTY, authorName: parsed.authorName };
  }
}

/**
 * TikTok のプロフィール。
 *
 * 表示名は oEmbed で取れる。投稿と同じ口にプロフィール URL を渡すと
 * embed_type: "profile" として返ってくる。ただし画像は返さないので、
 * プロフィール画像は埋め込みページの HTML から拾う。
 */
async function tiktokAccount(userName: string, canonicalUrl: string): Promise<FetchedMetadata> {
  const [data, avatar] = await Promise.all([
    oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`),
    tiktokAvatar(userName),
  ]);

  return {
    title: text(data?.author_name),
    authorName: userName,
    thumbnailUrl: avatar,
    resolved: null,
  };
}

/**
 * TikTok のプロフィール画像。
 *
 * 埋め込みページの HTML に入っている。100x100 で、寸法が署名に含まれているため
 * 大きい版に書き換えると 403 になる（実測）。URL 自体にも期限があるが、
 * 呼び出し側が受け取った直後に自分の Storage へ複製するので問題にならない。
 */
async function tiktokAvatar(userName: string): Promise<string | null> {
  const response = await get(`https://www.tiktok.com/embed/@${encodeURIComponent(userName)}`);
  if (!response) return null;

  const html = await response.text();
  const match = /"(https:(?:\\?\/){2}[^"]*?avt[^"]*?)"/.exec(html);
  if (!match) return null;

  // HTML に埋まった JSON なので "\/" と "&amp;" の両方が混ざっている
  return decodeEntities(match[1].replace(/\\+\//g, "/"));
}

/**
 * instagram.com 自身がプロフィール描画に使っているアプリ ID。
 * 文書化された API ではないので、失敗しても止めない前提で使う。
 */
const INSTAGRAM_APP_ID = "936619743392459";

/**
 * Instagram のプロフィール。
 *
 * プロフィールの /embed/ は投稿の /embed/ と違って画像を含む版と含まない版が
 * あり、同じ URL でも返るものが一定しない（実測）。そのため画像はここでは
 * 使わず、instagram.com が自分のプロフィール画面で叩いている口を同じヘッダで
 * 呼ぶ。非公開・年齢制限などで 400 や 404 が返ることがあり、実測でも
 * 7 件中 4 件しか取れていない。取れなければサムネ無しで登録する。
 */
type InstagramProfile = {
  full_name?: unknown;
  profile_pic_url?: unknown;
  profile_pic_url_hd?: unknown;
};

async function instagramAccount(userName: string): Promise<FetchedMetadata> {
  const response = await get(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(userName)}`,
    {
      "x-ig-app-id": INSTAGRAM_APP_ID,
      // これが無いと "SecFetch Policy violation" で 400 になる
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      Referer: `https://www.instagram.com/${encodeURIComponent(userName)}/`,
    }
  );

  if (!response) return { ...EMPTY, authorName: userName };

  let user: InstagramProfile | null = null;

  try {
    user = ((await response.json()) as { data?: { user?: InstagramProfile } })?.data?.user ?? null;
  } catch {
    return { ...EMPTY, authorName: userName };
  }

  return {
    title: text(user?.full_name),
    authorName: userName,
    thumbnailUrl: text(user?.profile_pic_url_hd) ?? text(user?.profile_pic_url),
    resolved: null,
  };
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


/* ------------------------------ Web ページ ------------------------------ */

/**
 * 読み込む HTML の上限。meta は <head> にあるので頭だけあれば足りる。
 * 相手のページの重さに引きずられないよう、途中で打ち切る。
 */
const MAX_HTML_BYTES = 512 * 1024;

/**
 * 既知のプラットフォーム以外の、普通の Web ページ。
 *
 * ここでの主役は OGP。実測では 18 サイト中 15 件が og:image を持っていた一方、
 * iframe に入れさせてくれたのは 3 件しかない。つまり大半は「枠では見せられないが
 * 絵と見出しは出せる」ので、そこを取りに行く。
 *
 * 取れなかったときは link に倒す（枠に入る前提で置いて、相手の拒否画面が出るより、
 * 最初からカードとして見せる方がよい）。
 */
async function fromWebsite(parsed: ParsedUrl): Promise<FetchedMetadata> {
  const asLink: FetchedMetadata = {
    ...EMPTY,
    resolved: { ...parsed, contentKind: "link" },
  };

  let response: ExternalResponse;

  try {
    // 貼られた URL は任意なので、社内向けの宛先に繋がないことを確かめてから叩く
    response = await fetchPublic(parsed.canonicalUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return asLink;
  }

  if (!response.ok) return asLink;

  const framable = allowsFraming(response);
  const html = await readHtml(response);

  const image =
    metaContent(html, "og:image") ??
    metaContent(html, "og:image:url") ??
    metaContent(html, "twitter:image") ??
    metaContent(html, "twitter:image:src");

  const title =
    metaContent(html, "og:title") ??
    metaContent(html, "twitter:title") ??
    textOrNull(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]);

  return {
    title,
    // 見出しの下に出る添え字。サイト名が無ければドメインで十分伝わる。
    authorName: siteName(html) ?? hostOf(parsed.canonicalUrl),
    thumbnailUrl: image ? absoluteUrl(image, parsed.canonicalUrl) : null,
    resolved: framable ? null : { ...parsed, contentKind: "link" },
  };
}

/**
 * iframe に入れさせてくれるか。
 *
 * X-Frame-Options があれば問答無用で入らない。CSP の frame-ancestors は
 * 相手が許可した先の一覧なので、* が無いかぎりこちらは入れない
 * （'self' や特定ドメインだけの指定が大半）。
 */
function allowsFraming(response: ExternalResponse): boolean {
  if (response.headers.get("x-frame-options")) return false;

  const policy = response.headers.get("content-security-policy") ?? "";
  const ancestors = /frame-ancestors([^;]*)/i.exec(policy)?.[1];

  if (ancestors === undefined) return true;

  return ancestors.split(/\s+/).includes("*");
}

/** 上限まで読んで、文字コードを判定して文字列にする。 */
async function readHtml(response: ExternalResponse): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (size < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch {
    // 途中で切れても、そこまでで meta が読めていれば十分
  }

  await reader.cancel().catch(() => {});

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return decodeHtml(bytes, response.headers.get("content-type"));
}

/**
 * HTML を文字列にする。
 *
 * 日本語のサイトには今でも Shift_JIS が残っていて（実測: sony.jp）、
 * UTF-8 として読むとタイトルが化ける。ヘッダの charset、無ければ本文の
 * meta を見る。知らない名前だったときは UTF-8 に倒す。
 */
function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));

  const charset =
    /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ??
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(head)?.[1] ??
    "utf-8";

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** meta タグの content を取る。属性の並び順は決まっていないので両方見る。 */
function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const found = textOrNull(pattern.exec(html)?.[1]);
    if (found) return found;
  }

  return null;
}

function textOrNull(value: string | undefined): string | null {
  const trimmed = value ? decodeEntities(value).replace(/\s+/g, " ").trim() : "";
  return trimmed === "" ? null : trimmed;
}

/** og:image は "/ogp.png" のような相対指定もあるので絶対 URL に直す。 */
function absoluteUrl(value: string, base: string): string | null {
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * サイト名。og:site_name にキャッチコピーごと入れているサイトがあるので
 * （実測: advertimes.com は 60 字超の一文）、名前として長すぎるものは採らない。
 */
function siteName(html: string): string | null {
  const name = metaContent(html, "og:site_name");
  return name && name.length <= 40 ? name : null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
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
