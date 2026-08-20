/**
 * 貼られた URL からプラットフォームと中身の種類を読み取り、埋め込み URL を組み立てる。
 *
 * 純粋関数だけにしてある（fetch も DB も触らない）。判定を間違えると再生できない
 * という分かりやすい壊れ方をするので、実行して確かめられる形にしておきたい。
 *
 * 判定できないものは platform: "other" に倒す。リンクとメモだけでもナレッジとしては
 * 成立するので、「登録できない URL」を作らないのが方針。
 */

export const PLATFORMS = ["instagram", "tiktok", "youtube", "x", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  other: "その他",
};

/**
 * 中身の種類。「どう見せるか」を表す。
 *
 * website と link はどちらも普通の Web ページで、違うのは枠に入れられるかどうか。
 * 相手が X-Frame-Options や CSP の frame-ancestors で拒んでいると iframe には
 * 入らないので、metadata.ts が実際にヘッダを見て link に倒す（実測では 18 件中
 * 15 件が拒んでいた。埋め込めない方が普通）。
 */
export const CONTENT_KINDS = [
  "reel",
  "post",
  "video",
  "short",
  "tweet",
  "account",
  "website",
  "link",
  "unknown",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  reel: "リール",
  post: "投稿",
  video: "動画",
  short: "ショート",
  tweet: "ポスト",
  account: "アカウント",
  website: "Web ページ",
  link: "Web ページ",
  unknown: "リンク",
};

export type ParsedUrl = {
  platform: Platform;
  contentKind: ContentKind;
  /** ショートコードや動画 ID。埋め込み URL の組み立てに使う。無ければ null。 */
  externalId: string | null;
  /** トラッキングパラメータを落とした URL。これを DB に保存する。 */
  canonicalUrl: string;
  /** URL から分かる投稿者（@なしのユーザー名）。メタ取得できなかったときの控え。 */
  authorName: string | null;
};

/**
 * 落とすクエリパラメータ。SNS の共有リンクには閲覧経路の記録が大量に付いてくる。
 * 残すと同じ投稿が別 URL として重複登録されてしまう（url に unique を張っている）。
 */
const TRACKING_PARAMS = [
  "igsh",
  "igshid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "si",
  "feature",
  "is_from_webapp",
  "sender_device",
  "web_id",
  "_r",
  "_t",
  "s",
  "t",
  "ref_src",
  "ref_url",
];

/**
 * Instagram のパス先頭に来る、ユーザー名ではない予約語。
 *
 * "share" を入れ忘れると事故る。アプリの「リンクをコピー」は
 * /share/reel/{トークン} という形を返すことがあり、これを
 * 「ユーザー名 share の reel」と読むと、投稿 ID ではないトークンで
 * 埋め込み URL を組み立ててしまう（Instagram 側は「削除された投稿」と表示する）。
 */
const INSTAGRAM_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "tv",
  "share",
  "stories",
  "explore",
  "accounts",
  "direct",
  "about",
]);

function stripTracking(url: URL): void {
  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }
}

/** 末尾スラッシュを落として比較しやすくする（"/p/ABC/" と "/p/ABC" を同じ扱いに）。 */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function parseInspirationUrl(raw: string): ParsedUrl | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  let url: URL;

  try {
    // スキームを省いて貼られることがあるので補う
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // 以後は https 固定で扱う（同じ投稿が http/https で二重登録されないように）
  url.protocol = "https:";
  url.hash = "";
  stripTracking(url);

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = segments(url.pathname);

  const parsed =
    parseInstagram(host, parts, url) ??
    parseTikTok(host, parts, url) ??
    parseYouTube(host, parts, url) ??
    parseX(host, parts, url);

  if (parsed) return parsed;

  // 既知のプラットフォームでなければ普通の Web ページとして扱う。
  // 枠に入るかどうかはヘッダを見ないと分からないので、ここでは website にしておき、
  // 拒まれていれば metadata.ts が link に倒す。
  return {
    platform: "other",
    contentKind: "website",
    externalId: null,
    canonicalUrl: url.toString(),
    authorName: null,
  };
}

/* ------------------------------ Instagram ------------------------------ */

function parseInstagram(host: string, parts: string[], url: URL): ParsedUrl | null {
  if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return null;

  const clean = (kind: ContentKind, path: string, id: string | null, author: string | null) => ({
    platform: "instagram" as const,
    contentKind: kind,
    externalId: id,
    canonicalUrl: `https://www.instagram.com${path}`,
    authorName: author,
  });

  // /p/{code}/ ・ /reel/{code}/ ・ /reels/{code}/ ・ /tv/{code}/
  const [first, second] = parts;

  if (first === "p" && second) return clean("post", `/p/${second}/`, second, null);
  if ((first === "reel" || first === "reels") && second) {
    return clean("reel", `/reel/${second}/`, second, null);
  }
  if (first === "tv" && second) return clean("post", `/tv/${second}/`, second, null);

  // /{username}/reel/{code}/ の形もある
  if (second === "reel" && parts[2] && !INSTAGRAM_RESERVED.has(first)) {
    return clean("reel", `/reel/${parts[2]}/`, parts[2], first);
  }
  if (second === "p" && parts[2] && !INSTAGRAM_RESERVED.has(first)) {
    return clean("post", `/p/${parts[2]}/`, parts[2], first);
  }

  // /{username}/ → アカウント。プロフィールにも埋め込みがある（下の toEmbedUrl）。
  // 識別子はユーザー名なので externalId に入れる。
  if (first && parts.length === 1 && !INSTAGRAM_RESERVED.has(first)) {
    return clean("account", `/${first}/`, first, first);
  }

  // /share/... はアプリが配る中継用の URL。この時点では投稿 ID が分からないので
  // externalId を空にし、metadata.ts 側で本来の URL へ展開させる。
  return {
    platform: "instagram",
    contentKind: "unknown",
    externalId: null,
    canonicalUrl: url.toString(),
    authorName: null,
  };
}

/** URL だけでは中身が確定せず、実際に辿らないと分からないものか。 */
export function needsResolution(parsed: ParsedUrl): boolean {
  return parsed.externalId === null && parsed.contentKind !== "account";
}

/* -------------------------------- TikTok -------------------------------- */

function parseTikTok(host: string, parts: string[], url: URL): ParsedUrl | null {
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return null;

  // vm.tiktok.com / vt.tiktok.com の短縮 URL は ID を含まない。
  // 展開にはリダイレクト追跡が要るので、ここでは種類だけ決めて metadata 側に任せる。
  if (host !== "tiktok.com") {
    return {
      platform: "tiktok",
      contentKind: "video",
      externalId: null,
      canonicalUrl: url.toString(),
      authorName: null,
    };
  }

  // /@{user}/video/{id} ・ /@{user}/photo/{id}
  const [first, second, third] = parts;

  if (first?.startsWith("@") && (second === "video" || second === "photo") && third) {
    const author = first.slice(1);
    return {
      platform: "tiktok",
      contentKind: "video",
      externalId: third,
      canonicalUrl: `https://www.tiktok.com/@${author}/${second}/${third}`,
      authorName: author,
    };
  }

  // /@{user} → アカウント。識別子はユーザー名。
  if (first?.startsWith("@") && parts.length === 1) {
    return {
      platform: "tiktok",
      contentKind: "account",
      externalId: first.slice(1),
      canonicalUrl: `https://www.tiktok.com/${first}`,
      authorName: first.slice(1),
    };
  }

  return {
    platform: "tiktok",
    contentKind: "unknown",
    externalId: null,
    canonicalUrl: url.toString(),
    authorName: null,
  };
}

/* -------------------------------- YouTube -------------------------------- */

function parseYouTube(host: string, parts: string[], url: URL): ParsedUrl | null {
  const isYouTube =
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com");

  if (!isYouTube) return null;

  const video = (id: string, kind: ContentKind) => ({
    platform: "youtube" as const,
    contentKind: kind,
    externalId: id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
    authorName: null,
  });

  // youtu.be/{id}
  if (host === "youtu.be" && parts[0]) return video(parts[0], "video");

  const [first, second] = parts;

  // /watch?v={id}
  const v = url.searchParams.get("v");
  if (first === "watch" && v) return video(v, "video");

  // /shorts/{id} ・ /embed/{id} ・ /live/{id}
  if (first === "shorts" && second) return video(second, "short");
  if ((first === "embed" || first === "live") && second) return video(second, "video");

  // /@{handle} → チャンネル。YouTube はチャンネルの埋め込みを提供していないので
  // 識別子だけ持ち、表示はリンクになる（toEmbedUrl 参照）。
  if (first?.startsWith("@") && parts.length === 1) {
    return {
      platform: "youtube",
      contentKind: "account",
      externalId: first.slice(1),
      canonicalUrl: `https://www.youtube.com/${first}`,
      authorName: first.slice(1),
    };
  }

  return {
    platform: "youtube",
    contentKind: "unknown",
    externalId: null,
    canonicalUrl: url.toString(),
    authorName: null,
  };
}

/* ---------------------------------- X ---------------------------------- */

function parseX(host: string, parts: string[], url: URL): ParsedUrl | null {
  if (host !== "x.com" && host !== "twitter.com" && !host.endsWith(".twitter.com")) {
    return null;
  }

  const [first, second, third] = parts;

  // /{user}/status/{id}
  if (first && second === "status" && third) {
    return {
      platform: "x",
      contentKind: "tweet",
      externalId: third,
      canonicalUrl: `https://x.com/${first}/status/${third}`,
      authorName: first,
    };
  }

  // /{user} → アカウント。識別子はユーザー名。
  if (first && parts.length === 1) {
    return {
      platform: "x",
      contentKind: "account",
      externalId: first,
      canonicalUrl: `https://x.com/${first}`,
      authorName: first,
    };
  }

  return {
    platform: "x",
    contentKind: "unknown",
    externalId: null,
    canonicalUrl: url.toString(),
    authorName: null,
  };
}

/* ------------------------------ 埋め込み URL ------------------------------ */

/**
 * iframe に入れる URL。埋め込めないものは null。
 *
 * 投稿は X-Frame-Options も CSP の frame-ancestors も付いていないことを実測で
 * 確認している。アカウントは Instagram と TikTok だけ（toAccountEmbedUrl 参照）。
 *
 * @param sourceUrl 保存してある元の URL。アカウントのユーザー名はここから読み直す。
 */
export function toEmbedUrl(
  platform: Platform,
  contentKind: ContentKind,
  externalId: string | null,
  sourceUrl?: string | null
): string | null {
  if (contentKind === "unknown" || contentKind === "link") return null;

  // 普通の Web ページは、そのページ自体を枠に入れる
  if (contentKind === "website") return sourceUrl ?? null;

  if (contentKind === "account") {
    return toAccountEmbedUrl(platform, accountNameOf(externalId, sourceUrl));
  }

  if (!externalId) return null;

  switch (platform) {
    case "instagram":
      // リールも /reel/ のまま埋め込める
      return `https://www.instagram.com/${contentKind === "reel" ? "reel" : "p"}/${externalId}/embed/`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${externalId}`;
    case "youtube":
      // nocookie 版。追跡クッキーを置かせない。
      return `https://www.youtube-nocookie.com/embed/${externalId}`;
    case "x":
      return `https://platform.twitter.com/embed/Tweet.html?id=${externalId}`;
    default:
      return null;
  }
}

/**
 * 埋め込みに使うアカウント名を決める。
 *
 * URL から読み直すのが基本で、externalId は控え。アカウントの識別子を
 * externalId に入れるようにする前の行は空になっており、そこを投稿者名で
 * 埋めると「渡邉」のような表示名で URL を組んでしまう（Instagram も TikTok も
 * 存在しないユーザーとして「削除された可能性があります」を出す）。
 * URL は必ず保存されているので、そちらの方が確実。
 */
function accountNameOf(externalId: string | null, sourceUrl?: string | null): string | null {
  if (sourceUrl) {
    const parsed = parseInspirationUrl(sourceUrl);
    if (parsed?.contentKind === "account" && parsed.externalId) return parsed.externalId;
  }

  return externalId;
}

/** ユーザー名として通る文字だけか。表示名を URL に混ぜてしまう事故を止める。 */
const USER_NAME = /^[A-Za-z0-9._-]{1,30}$/;

/**
 * プロフィールの埋め込み URL。
 *
 * 提供の仕方がプラットフォームごとに違うので、実際に叩いて確かめたものだけを使う。
 *  - Instagram : 投稿と同じ /embed/ がユーザー名でも通る
 *  - TikTok    : 投稿の /embed/v2/{id} とは別で、/embed/@{user} を使う
 *                （/embed/v2/@{user} は 400 になる）
 *  - YouTube   : チャンネルの埋め込みは提供されていないのでリンクのまま
 *  - X         : 埋め込まない。widgets.js が使うタイムラインの口
 *    （syndication.twitter.com/srv/timeline-profile/…）は未ログインだと
 *    x-rate-limit-limit: 30 で絞られており、プロフィール 1 枚でその大半を使う。
 *    実測でも 4 回中 3 回が 429（本文は "Rate limit exceeded" の 20 バイトだけ）で、
 *    社内の共有回線なら即座に尽きる。たまに映る枠を出すより、リンクの方が良い。
 */
function toAccountEmbedUrl(platform: Platform, userName: string | null): string | null {
  if (!userName) return null;

  const name = userName.replace(/^@/, "");
  if (!USER_NAME.test(name)) return null;

  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${name}/embed/`;
    case "tiktok":
      return `https://www.tiktok.com/embed/@${name}`;
    default:
      return null;
  }
}

/**
 * 埋め込みの縦横比。リール・ショート・TikTok は縦長、それ以外は横長。
 * ダイアログの大きさを決めるのに使う。
 */
export function embedAspect(platform: Platform, contentKind: ContentKind): "portrait" | "landscape" {
  // Web ページは横長の画面を前提に作られている
  if (contentKind === "website" || contentKind === "link") return "landscape";
  // プロフィールは縦に伸びる
  if (contentKind === "account") return "portrait";
  if (contentKind === "reel" || contentKind === "short") return "portrait";
  if (platform === "tiktok") return "portrait";
  if (platform === "instagram") return "portrait";
  return "landscape";
}
